import { Controller, Get, Header, Query } from '@nestjs/common';
import { AppService } from './app.service';
import path from 'path';
import Docker from 'dockerode';
import { processAnsiText } from './utils';
export enum DockerRunStatus {
  running = 'running',
  exited = 'exited',
}
const docker = new Docker();

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Header('Access-Control-Allow-Origin', '*')
  @Get()
  async getHello(@Query() query): Promise<string> {
    async function getContainerLog(container: Docker.Container) {
      let outputString: any = await container?.logs({
        stdout: true,
        stderr: true,
      });

      if (Buffer.isBuffer(outputString)) {
        outputString = outputString.toString('utf-8');
      }

      const containerInfo = await container?.inspect();
      const isRunning = containerInfo.State.Running;
      if (!isRunning) {
        container.remove({});
        return outputString;
      }
    }
    // 这里\n之间不能留空格
    const wrapCode = `\n${decodeURI(query.code)}\nEOF\n`;

    const bashCmd = `cat > code.ts << 'EOF' ${wrapCode} ./node_modules/typescript/bin/tsc code.ts\nnode code.js`;
    const done = () =>
      new Promise<string>(async (resolve, reject) => {
        docker.createContainer(
          {
            Image: 'custom-node',
            Cmd: ['/bin/bash', '-c', bashCmd],
            StopTimeout: 6,
            Tty: true,
            AttachStdout: true,
            NetworkDisabled: true,
          },
          function (err, container) {
            if (err) {
              reject(err);
            }
            container.start({}, function (err, data) {
              if (err) {
                reject(err);
              }
              container.attach(
                { stream: true, stdout: true, stderr: true },
                function (err, stream) {
                  if (err) {
                    reject(err);
                  }
                  stream.pipe(process.stdout);
                },
              );

              container?.wait(async (status) => {
                if (!status || status?.Status === DockerRunStatus.exited) {
                  const logs = await getContainerLog(container);
                  resolve(logs);
                }
              });
            });
          },
        );
      });
    const image = docker.getImage('custom-node');

    if (!image) {
      docker.buildImage(
        {
          context: path.resolve(__dirname, '../..'),
          src: ['Dockerfile'],
        },
        {
          t: 'custom-node',
        },
        function (err, stream) {
          if (err) {
            console.error('Image Build error!:', err);
            return;
          }

          stream.pipe(process.stdout, {
            end: true,
          });

          stream.on('end', async function () {
            return await done();
          });
        },
      );
    } else {
      const res = await done();

      return processAnsiText(res);
    }
  }
}
