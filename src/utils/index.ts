// 因为是docker node环境下输出编译结果。会带有颜色的ANSI转义码，需要处理成可读文本
export function processAnsiText(text) {
  let newText = text;
  // 步骤 1: 将 ANSI 转义码中的换行符替换为 \n
  newText = newText.replace(/\u001b\[[0-9;]*m\n/g, '\n');

  // 步骤 2: 清除其他无意义的 ANSI 转义码
  newText = newText.replace(/\u001b\[[0-9;]*m/g, '');

  return newText;
}
