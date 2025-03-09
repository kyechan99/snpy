import * as readline from "readline";

type OptionType = "list" | "nlist" | "checkbox" | "confirm" | "input";

interface Option {
  type: OptionType;
  name: string;
  message: string;
  choices?: string[];
  default?: string | boolean;
}

interface ProcessStep {
  type: OptionType;
  name: string;
  message: string;
  choices?: string[];
  default?: string | boolean;
}

export class Snpy {
  private options: Option[] = [];
  private responses: Record<string, any> = {};
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // ANSI 색상 코드
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

  constructor() {
    // Raw 모드 설정
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  addOption(option: Option) {
    this.options.push(option);
  }

  async process() {
    for (const option of this.options) {
      // 각 옵션 실행 전에 raw 모드로 설정
      process.stdin.setRawMode(true);

      switch (option.type) {
        case "list":
        case "nlist":
        case "checkbox":
          this.responses[option.name] = await this.askSelectable(option);
          break;
        case "confirm":
          // confirm과 input은 텍스트 입력이 필요하므로 raw 모드 해제
          process.stdin.setRawMode(false);
          this.responses[option.name] = await this.askConfirm(option);
          break;
        case "input":
          process.stdin.setRawMode(false);
          this.responses[option.name] = await this.askInput(option);
          break;
      }
    }

    this.rl.close();
    return this.responses;
  }

  private askQuestion(query: string): Promise<string> {
    return new Promise((resolve) => this.rl.question(query, resolve));
  }

  private async askList(option: Option): Promise<string> {
    return this.askSelectable(option);
  }

  private async askNList(option: Option): Promise<string> {
    return this.askSelectable(option);
  }

  private async askSelectable(option: Option): Promise<string> {
    console.log(this.colors.cyan + option.message + this.colors.reset);
    let currentIndex = 0;

    const printChoices = () => {
      console.clear();
      console.log(this.colors.cyan + option.message + this.colors.reset);
      option.choices?.forEach((choice, index) => {
        const prefix = option.type === "nlist" ? `${index + 1}) ` : "  ";
        if (index === currentIndex) {
          console.log(
            this.colors.green +
              this.colors.bright +
              `> ${prefix}${choice}` +
              this.colors.reset
          );
        } else {
          console.log(`  ${prefix}${choice}`);
        }
      });
    };

    return new Promise<string>((resolve) => {
      printChoices();
      const keyPressHandler = (str: string, key: readline.Key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        } else if (key.name === "up" && currentIndex > 0) {
          currentIndex--;
          printChoices();
        } else if (
          key.name === "down" &&
          currentIndex < (option.choices?.length || 1) - 1
        ) {
          currentIndex++;
          printChoices();
        } else if (key.name === "return") {
          process.stdin.removeListener("keypress", keyPressHandler);
          console.log(); // 새 줄 추가
          resolve(option.choices?.[currentIndex] || "");
        }
      };
      process.stdin.on("keypress", keyPressHandler);
    });
  }

  private async askCheckbox(option: Option): Promise<string[]> {
    console.log(this.colors.cyan + option.message + this.colors.reset);
    let currentIndex = 0;
    let selectedItems = new Set<number>();

    const printChoices = () => {
      console.clear();
      console.log(this.colors.cyan + option.message + this.colors.reset);
      option.choices?.forEach((choice, index) => {
        const isSelected = selectedItems.has(index);
        const marker = isSelected ? "●" : "○";
        if (index === currentIndex) {
          console.log(
            this.colors.green +
              this.colors.bright +
              `> ${marker} ${choice}` +
              this.colors.reset
          );
        } else {
          console.log(
            ` ${this.colors.dim} ${marker} ${choice}${this.colors.reset}`
          );
        }
      });
      console.log(
        this.colors.dim +
          "\n(Space to select, Enter to confirm)" +
          this.colors.reset
      );
    };

    return new Promise<string[]>((resolve) => {
      printChoices();
      const keyPressHandler = (str: string, key: readline.Key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        } else if (key.name === "up" && currentIndex > 0) {
          currentIndex--;
          printChoices();
        } else if (
          key.name === "down" &&
          currentIndex < (option.choices?.length || 1) - 1
        ) {
          currentIndex++;
          printChoices();
        } else if (key.name === "space") {
          if (selectedItems.has(currentIndex)) {
            selectedItems.delete(currentIndex);
          } else {
            selectedItems.add(currentIndex);
          }
          printChoices();
        } else if (key.name === "return") {
          process.stdin.removeListener("keypress", keyPressHandler);
          console.log(); // 새 줄 추가
          const selectedChoices = Array.from(selectedItems)
            .sort()
            .map((index) => option.choices?.[index] || "");
          resolve(selectedChoices);
        }
      };
      process.stdin.on("keypress", keyPressHandler);
    });
  }

  private async askInput(option: Option): Promise<string> {
    const prompt = `${option.message}: `;
    const defaultValue = option.default?.toString() || "";

    process.stdout.write(this.colors.cyan + prompt + this.colors.reset);

    return new Promise((resolve) => {
      let input = "";
      let hasInput = false;

      const showDefaultValue = () => {
        process.stdout.write(
          this.colors.dim + defaultValue + this.colors.reset
        );
        process.stdout.write("\x1b[" + defaultValue.length + "D");
      };

      const resetLine = () => {
        process.stdout.write("\r");
        process.stdout.write("\x1b[K");
        process.stdout.write(this.colors.cyan + prompt + this.colors.reset);
        if (input.length > 0) {
          process.stdout.write(input);
        } else {
          hasInput = false;
          showDefaultValue();
        }
      };

      showDefaultValue();

      const keyPressHandler = (str: string, key: readline.Key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        }

        if (key.name === "return") {
          process.stdin.removeListener("keypress", keyPressHandler);
          process.stdout.write("\n");
          resolve(input || defaultValue);
        } else if (key.name === "backspace") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            resetLine();
          }
        } else if (str && !key.ctrl && !key.meta) {
          if (!hasInput) {
            hasInput = true;
          }
          input += str;
          resetLine();
        }
      };

      process.stdin.setRawMode(true);
      process.stdin.on("keypress", keyPressHandler);
    });
  }

  private async askConfirm(option: Option): Promise<boolean> {
    const defaultValue =
      option.default === undefined
        ? "Y"
        : option.default === true
        ? "Y"
        : option.default === false
        ? "N"
        : "Y";

    const choices = defaultValue.toLowerCase() === "y" ? "Y/n" : "y/N";
    const prompt = `${option.message} (${choices}): `;

    process.stdout.write(this.colors.cyan + prompt + this.colors.reset);

    return new Promise((resolve) => {
      let input = "";
      let hasInput = false;

      const showDefaultValue = () => {
        process.stdout.write(
          this.colors.dim + defaultValue + this.colors.reset
        );
        process.stdout.write("\x1b[" + defaultValue.length + "D");
      };

      const resetLine = () => {
        process.stdout.write("\r");
        process.stdout.write("\x1b[K");
        process.stdout.write(this.colors.cyan + prompt + this.colors.reset);
        if (input.length > 0) {
          process.stdout.write(input);
        } else {
          hasInput = false;
          showDefaultValue();
        }
      };

      showDefaultValue();

      const keyPressHandler = (str: string, key: readline.Key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        }

        if (key.name === "return") {
          process.stdin.removeListener("keypress", keyPressHandler);
          process.stdout.write("\n");
          const finalValue = input || defaultValue;
          resolve(finalValue.toLowerCase() === "y");
        } else if (key.name === "backspace") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            resetLine();
          }
        } else if (str && !key.ctrl && !key.meta) {
          const char = str.toLowerCase();
          if (char === "y" || char === "n") {
            if (!hasInput) {
              hasInput = true;
            }
            input = str.toLowerCase();
            resetLine();
          }
        }
      };

      process.stdin.setRawMode(true);
      process.stdin.on("keypress", keyPressHandler);
    });
  }

  getResponses(): Record<string, any> {
    return this.responses;
  }

  getResponse(name: string): any {
    return this.responses[name];
  }

  generateTemplate() {
    if (!this.responses || Object.keys(this.responses).length === 0) {
      console.log(
        this.colors.red +
          "No responses available. Please run process() first." +
          this.colors.reset
      );
      return;
    }

    console.log(this.colors.cyan + "\nSelected options:" + this.colors.reset);
    for (const [key, value] of Object.entries(this.responses)) {
      console.log(
        `${this.colors.yellow}${key}${this.colors.reset}: ${
          this.colors.green
        }${JSON.stringify(value)}${this.colors.reset}`
      );
    }

    if (this.responses.confirmation) {
      console.log(
        this.colors.green +
          "\nGenerating template with selected options..." +
          this.colors.reset
      );
    } else {
      console.log(
        this.colors.red + "\nTemplate generation cancelled." + this.colors.reset
      );
    }
  }
}

const snpy = new Snpy();

snpy.addOption({
  type: "list",
  name: "framework",
  message: "Choose a framework:",
  choices: ["React", "Vue", "Angular", "Svelte"],
});

snpy.addOption({
  type: "nlist",
  name: "database",
  message: "Choose a database:",
  choices: ["MySQL", "PostgreSQL", "MongoDB", "Redis"],
});

snpy.addOption({
  type: "checkbox",
  name: "features",
  message: "Select features to include:",
  choices: [
    "Authentication",
    "API Integration",
    "File Upload",
    "Real-time Updates",
  ],
});

snpy.addOption({
  type: "input",
  name: "projectName",
  message: "Enter your project name",
  default: "my-awesome-project",
});

snpy.addOption({
  type: "confirm",
  name: "typescript",
  message: "Would you like to use TypeScript?",
  default: true,
});

snpy.addOption({
  type: "confirm",
  name: "confirmation",
  message: "Do you want to proceed with these settings?",
});

(async () => {
  const responses = await snpy.process();
  snpy.generateTemplate();
})();
