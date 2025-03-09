import * as readline from "readline";

class IO {
  private readonly colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
  };

  private keyPressHandler?: (str: string, key: readline.Key) => void;

  constructor() {
    this.setupKeyPress();
  }

  // Input handling
  private setupKeyPress(): void {
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  onKeyPress(handler: (str: string, key: readline.Key) => void): void {
    this.removeKeyPressHandler();
    this.keyPressHandler = handler;
    process.stdin.on("keypress", handler);
  }

  removeKeyPressHandler(): void {
    if (this.keyPressHandler) {
      process.stdin.removeListener("keypress", this.keyPressHandler);
      this.keyPressHandler = undefined;
    }
  }

  setRawMode(mode: boolean): void {
    process.stdin.setRawMode(mode);
  }

  // Output handling
  clear(): void {
    console.clear();
  }

  message(message: string): void {
    process.stdout.write(this.colors.cyan + message + this.colors.reset);
  }

  prompt(prompt: string): void {
    process.stdout.write(this.colors.cyan + prompt + this.colors.reset);
  }

  defaultValue(value: string): void {
    process.stdout.write(this.colors.dim + value + this.colors.reset);
  }

  resetCursor(length: number): void {
    process.stdout.write("\x1b[" + length + "D");
  }

  clearLine(): void {
    process.stdout.write("\r\x1b[K");
  }

  newLine(): void {
    process.stdout.write("\n");
  }

  write(text: string): void {
    process.stdout.write(text);
  }

  choice(
    choice: string,
    isSelected: boolean = false,
    prefix: string = ""
  ): void {
    if (isSelected) {
      this.write(
        this.colors.green +
          this.colors.bright +
          `> ${prefix}${choice}` +
          this.colors.reset
      );
    } else {
      this.write(`  ${prefix}${choice}`);
    }
  }

  dimChoice(choice: string, marker: string = ""): void {
    this.write(` ${this.colors.dim} ${marker} ${choice}${this.colors.reset}`);
  }

  hint(text: string): void {
    this.write(this.colors.dim + text + this.colors.reset);
  }

  error(text: string): void {
    this.write(this.colors.red + text + this.colors.reset);
  }

  success(text: string): void {
    this.write(this.colors.green + text + this.colors.reset);
  }

  value(key: string, value: any): void {
    this.write(
      `${this.colors.yellow}${key}${this.colors.reset}: ${
        this.colors.green
      }${JSON.stringify(value)}${this.colors.reset}\n`
    );
  }
}
export default IO;
