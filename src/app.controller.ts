import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import Docker from 'dockerode';
import stream from 'stream';
import path from 'path';
export enum DockerRunStatus {
  running = 'running',
  exited = 'exited',
}
const docker = new Docker();
let result = '';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
        result = outputString;
        container.remove({});
      }
    }
    // 这里\n之间不能留空格
    const wrapCode = `\n${decodeURI(query.code)}\nEOF\n`;

    const bashCmd = `cat > code.txt << 'EOF' ${wrapCode} cat code.txt`;
    const done = () => {
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
          console.log('===err', err);

          container.start({}, function (err, data) {
            container.attach(
              { stream: true, stdout: true, stderr: true },
              function (err, stream) {
                stream.pipe(process.stdout);
              },
            );

            container?.wait((status) => {
              if (!status || status?.Status === DockerRunStatus.exited) {
                getContainerLog(container);
              }
            });
          });
        },
      );
    };
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

          stream.on('end', function () {
            done();
          });
        },
      );
    } else {
      done();
    }

    return result;
  }
}
