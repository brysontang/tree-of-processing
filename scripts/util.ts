export const extractCodeFromOutput = (output: string) => {
  const regex = /```HTML\n([\s\S]*?)```/;
  const match = output.match(regex);

  if (match) {
    return match[1];
  }

  return null;
};
