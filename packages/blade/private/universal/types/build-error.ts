export default interface BuildError {
  location: {
    file: string;
    text: string;
    line: number;
    suggestion: string;
  };
  errorMessage: string;
}
