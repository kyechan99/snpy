import * as readline from 'readline';

class IO {
  hideInput = false;
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  private readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
  };

  private keyPressHandler?: (str: string, key: readline.Key) => void;

  constructor() {
    this.setupKeyPress();
  }

  private setupKeyPress() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  onKeyPress(handler: (str: string, key: readline.Key) => void) {
    this.removeKeyPressHandler();
    this.keyPressHandler = (str, key) => {
      if (this.hideInput) {
        process.stdout.write('\x1B[2K\x1B[200D');
      }
      if (key.ctrl && key.name === 'c') {
        process.exit();
      }
      handler(str, key);
    };
    process.stdin.on('keypress', this.keyPressHandler);
  }

  removeKeyPressHandler() {
    if (this.keyPressHandler) {
      process.stdin.removeListener('keypress', this.keyPressHandler);
      this.keyPressHandler = undefined;
    }
  }

  setRawMode(mode: boolean) {
    process.stdin.setRawMode(mode);
    this.setHideInput(mode);
  }

  clear() {
    console.clear();
  }

  message(message: string) {
    process.stdout.write(this.colors.cyan + message + this.colors.reset);
  }

  prompt(prompt: string) {
    process.stdout.write(this.colors.cyan + prompt + this.colors.reset);
  }

  defaultValue(value: string) {
    process.stdout.write(this.colors.dim + value + this.colors.reset);
  }

  resetCursor(length: number) {
    process.stdout.write('\x1b[' + length + 'D');
  }

  clearLine() {
    process.stdout.write('\r\x1b[K');
  }

  newLine() {
    process.stdout.write('\n');
  }

  write(text: string) {
    process.stdout.write(text);
  }

  setHideInput(hideInput: boolean) {
    this.hideInput = hideInput;
  }

  choice(choice: string, isSelected: boolean = false, prefix: string = '') {
    if (isSelected) {
      this.write(this.colors.green + this.colors.bright + `> ${prefix}${choice}` + this.colors.reset);
    } else {
      this.write(`  ${prefix}${choice}`);
    }
  }

  dimChoice(choice: string, marker: string = '') {
    this.write(` ${this.colors.dim} ${marker} ${choice}${this.colors.reset}`);
  }

  hint(text: string) {
    this.write(this.colors.dim + text + this.colors.reset);
  }

  error(text: string) {
    this.write(this.colors.red + text + this.colors.reset);
  }

  success(text: string) {
    this.write(this.colors.green + text + this.colors.reset);
  }

  value(key: string, value: any) {
    this.write(
      `${this.colors.yellow}${key}${this.colors.reset}: ${
        this.colors.green
      }${JSON.stringify(value)}${this.colors.reset}\n`,
    );
  }

  exit() {
    this.rl.close();
  }
}
export default IO;
