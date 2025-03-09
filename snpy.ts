import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import IO from "./io";

type OptionType =
  | "list"
  | "nlist"
  | "checkbox"
  | "confirm"
  | "input"
  | "directory";

interface Option {
  type: OptionType;
  name: string;
  message: string;
  choices?: string[];
  default?: string | boolean;
  basePath?: string;
}

interface ProcessStep {
  type: OptionType;
  name: string;
  message: string;
  choices?: string[];
  default?: string | boolean;
}

const SELECT_THIS_PATH = "[ SELECT THIS PATH ]";
const SELECT_BACK_PATH = "..";

export class Snpy {
  private options: Option[] = [];
  private responses: Record<string, any> = {};
  private rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  private io = new IO();

  constructor() {}

  addOption(option: Option) {
    this.options.push(option);
  }

  async process() {
    for (const option of this.options) {
      switch (option.type) {
        case "list":
        case "nlist":
          this.io.setRawMode(true);
          this.responses[option.name] = await this.askSelectable(option);
          break;
        case "checkbox":
          this.io.setRawMode(true);
          this.responses[option.name] = await this.askCheckbox(option);
          break;
        case "confirm":
          this.io.setRawMode(false);
          this.responses[option.name] = await this.askConfirm(option);
          break;
        case "input":
          this.io.setRawMode(false);
          this.responses[option.name] = await this.askInput(option);
          break;
        case "directory":
          this.io.setRawMode(true);
          this.responses[option.name] = await this.askDirectory(option);
          break;
      }
    }

    this.rl.close();
    return this.responses;
  }

  private getVisibleChoices<T>(
    items: T[],
    currentIndex: number,
    maxVisible: number = 10
  ): { start: number; end: number; showTop: boolean; showBottom: boolean } {
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(0, currentIndex - half);
    let end = Math.min(items.length, start + maxVisible);

    // 끝부분에 도달했을 때 시작 위치 조정
    if (end === items.length) {
      start = Math.max(0, end - maxVisible);
    }
    // 시작부분에서 끝 위치 조정
    if (start === 0) {
      end = Math.min(items.length, maxVisible);
    }

    return {
      start,
      end,
      showTop: start > 0,
      showBottom: end < items.length,
    };
  }

  private async askSelectable(option: Option): Promise<string> {
    this.io.message(option.message);
    let currentIndex = 0;

    const printChoices = () => {
      this.io.clear();
      this.io.message(option.message);

      const choices = option.choices || [];
      const { start, end, showTop, showBottom } = this.getVisibleChoices(
        choices,
        currentIndex
      );
      const visibleChoices = choices.slice(start, end);

      // 스크롤이 필요한 경우에만 12줄 유지
      const needsScroll = showTop || showBottom;

      this.io.newLine();
      if (needsScroll && showTop) {
        this.io.hint("   ▲");
      }
      this.io.newLine();

      // 스크롤이 필요한 경우 10줄, 아닌 경우 실제 선택지 수만큼
      const targetLines = needsScroll ? 10 : choices.length;
      for (let i = 0; i < targetLines; i++) {
        if (i < visibleChoices.length) {
          const choice = visibleChoices[i];
          const actualIndex = start + i;
          const prefix = option.type === "nlist" ? `${actualIndex + 1}) ` : "";
          if (actualIndex === currentIndex) {
            this.io.choice(choice, true, prefix);
          } else {
            this.io.choice(choice, false, prefix);
          }
        }
        this.io.newLine();
      }

      if (needsScroll && showBottom) {
        this.io.hint("   ▼");
      }
      this.io.newLine();
    };

    return new Promise<string>((resolve) => {
      printChoices();

      this.io.onKeyPress((str, key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        } else if (key.name === "up") {
          currentIndex =
            currentIndex > 0
              ? currentIndex - 1
              : (option.choices?.length || 1) - 1;
          printChoices();
        } else if (key.name === "down") {
          currentIndex =
            currentIndex < (option.choices?.length || 1) - 1
              ? currentIndex + 1
              : 0;
          printChoices();
        } else if (key.name === "return") {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          resolve(option.choices?.[currentIndex] || "");
        }
      });
    });
  }

  private async askCheckbox(option: Option): Promise<string[]> {
    this.io.message(option.message);
    let currentIndex = 0;
    let selectedItems = new Set<number>();

    const printChoices = () => {
      this.io.clear();
      this.io.message(option.message);

      const choices = option.choices || [];
      const { start, end, showTop, showBottom } = this.getVisibleChoices(
        choices,
        currentIndex
      );
      const visibleChoices = choices.slice(start, end);

      // 스크롤이 필요한 경우에만 12줄 유지
      const needsScroll = showTop || showBottom;

      this.io.newLine();
      if (needsScroll && showTop) {
        this.io.hint("   ▲");
      }
      this.io.newLine();

      // 스크롤이 필요한 경우 10줄, 아닌 경우 실제 선택지 수만큼
      const targetLines = needsScroll ? 10 : choices.length;
      for (let i = 0; i < targetLines; i++) {
        if (i < visibleChoices.length) {
          const choice = visibleChoices[i];
          const actualIndex = start + i;
          const isSelected = selectedItems.has(actualIndex);
          const marker = isSelected ? "⬢" : "⬡";
          if (actualIndex === currentIndex) {
            this.io.choice(choice, true, marker + "  ");
          } else {
            this.io.choice(choice, false, marker + "  ");
          }
        }
        this.io.newLine();
      }

      if (needsScroll && showBottom) {
        this.io.hint("   ▼");
      }
      this.io.newLine();
      this.io.hint("\n(Space to select, Enter to confirm)\n");
    };

    return new Promise<string[]>((resolve) => {
      printChoices();

      this.io.onKeyPress((str, key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        } else if (key.name === "up") {
          currentIndex =
            currentIndex > 0
              ? currentIndex - 1
              : (option.choices?.length || 1) - 1;
          printChoices();
        } else if (key.name === "down") {
          currentIndex =
            currentIndex < (option.choices?.length || 1) - 1
              ? currentIndex + 1
              : 0;
          printChoices();
        } else if (key.name === "space") {
          if (selectedItems.has(currentIndex)) {
            selectedItems.delete(currentIndex);
          } else {
            selectedItems.add(currentIndex);
          }
          printChoices();
        } else if (key.name === "return") {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          const selectedChoices = Array.from(selectedItems)
            .sort()
            .map((index) => option.choices?.[index] || "");
          resolve(selectedChoices);
        }
      });
    });
  }

  private async askInput(option: Option): Promise<string> {
    const prompt = `${option.message}: `;
    const defaultValue = option.default?.toString() || "";

    this.io.clear();
    this.io.prompt(prompt);

    return new Promise((resolve) => {
      let input = "";
      let hasInput = false;

      const showDefaultValue = () => {
        this.io.defaultValue(defaultValue);
        this.io.resetCursor(defaultValue.length);
      };

      const resetLine = () => {
        this.io.clearLine();
        this.io.prompt(prompt);
        if (input.length > 0) {
          this.io.write(input);
        } else {
          hasInput = false;
          showDefaultValue();
        }
      };

      showDefaultValue();

      this.io.onKeyPress((str, key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        }

        if (key.name === "return") {
          this.io.removeKeyPressHandler();
          this.io.newLine();
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
      });

      this.io.setRawMode(true);
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

    this.io.clear();
    this.io.prompt(prompt);

    return new Promise((resolve) => {
      let input = "";
      let hasInput = false;

      const showDefaultValue = () => {
        this.io.defaultValue(defaultValue);
        this.io.resetCursor(defaultValue.length);
      };

      const resetLine = () => {
        this.io.clearLine();
        this.io.prompt(prompt);
        if (input.length > 0) {
          this.io.write(input);
        } else {
          hasInput = false;
          showDefaultValue();
        }
      };

      showDefaultValue();

      this.io.onKeyPress((str, key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        }

        if (key.name === "return") {
          this.io.removeKeyPressHandler();
          this.io.newLine();
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
      });

      this.io.setRawMode(true);
    });
  }

  private getDirectories(source: string): string[] {
    return fs
      .readdirSync(source, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  }

  private async askDirectory(option: Option): Promise<string> {
    let currentPath = option.basePath || ".";
    let selectedPath = "";

    const getChoices = (dirPath: string): string[] => {
      const dirs = this.getDirectories(dirPath);
      const choices = [SELECT_THIS_PATH];

      if (currentPath !== (option.basePath || ".")) {
        choices.push(SELECT_BACK_PATH);
      }

      return [...choices, ...dirs];
    };

    const printChoices = (choices: string[], currentIndex: number) => {
      this.io.clear();
      this.io.message(option.message + "\n");
      this.io.message("Current path: " + currentPath + "\n");

      const { start, end, showTop, showBottom } = this.getVisibleChoices(
        choices,
        currentIndex
      );
      const visibleChoices = choices.slice(start, end);

      // 스크롤이 필요한 경우에만 12줄 유지
      const needsScroll = showTop || showBottom;

      this.io.newLine();
      if (needsScroll && showTop) {
        this.io.hint("   ▲");
      }
      this.io.newLine();

      // 스크롤이 필요한 경우 10줄, 아닌 경우 실제 선택지 수만큼
      const targetLines = needsScroll ? 10 : choices.length;
      for (let i = 0; i < targetLines; i++) {
        if (i < visibleChoices.length) {
          const choice = visibleChoices[i];
          const actualIndex = start + i;
          if (actualIndex === currentIndex) {
            this.io.choice(
              choice,
              true,
              choice === SELECT_THIS_PATH
                ? ""
                : choice === SELECT_BACK_PATH
                ? "📂 "
                : "📁 "
            );
          } else {
            this.io.choice(
              choice,
              false,
              choice === SELECT_THIS_PATH
                ? ""
                : choice === SELECT_BACK_PATH
                ? "📂 "
                : "📁 "
            );
          }
        }
        this.io.newLine();
      }

      if (needsScroll && showBottom) {
        this.io.hint("   ▼");
      }
      this.io.newLine();
      this.io.hint("\n(Enter to select, Backspace to go up)\n");
    };

    return new Promise<string>((resolve) => {
      let currentIndex = 0;
      let choices = getChoices(currentPath);

      const handleNavigation = () => {
        printChoices(choices, currentIndex);
      };

      handleNavigation();

      this.io.onKeyPress((str, key) => {
        if (key.ctrl && key.name === "c") {
          process.exit();
        } else if (key.name === "up") {
          currentIndex =
            currentIndex > 0 ? currentIndex - 1 : choices.length - 1;
          handleNavigation();
        } else if (key.name === "down") {
          currentIndex =
            currentIndex < choices.length - 1 ? currentIndex + 1 : 0;
          handleNavigation();
        } else if (key.name === "return") {
          const selected = choices[currentIndex];

          if (selected === SELECT_THIS_PATH) {
            this.io.removeKeyPressHandler();
            this.io.newLine();
            resolve(currentPath);
          } else if (selected === SELECT_BACK_PATH) {
            if (currentPath !== (option.basePath || ".")) {
              currentPath = path.dirname(currentPath);
              choices = getChoices(currentPath);
              currentIndex = 0;
              handleNavigation();
            }
          } else {
            currentPath = path.join(currentPath, selected);
            choices = getChoices(currentPath);
            currentIndex = 0;
            handleNavigation();
          }
        } else if (key.name === "backspace") {
          if (currentPath !== (option.basePath || ".")) {
            currentPath = path.dirname(currentPath);
            choices = getChoices(currentPath);
            currentIndex = 0;
            handleNavigation();
          }
        }
      });
    });
  }

  generateTemplate() {
    this.io.clear();

    if (!this.responses || Object.keys(this.responses).length === 0) {
      this.io.error("No responses available. Please run process() first.\n");
      return;
    }

    this.io.message("\nSelected options:\n");
    for (const [key, value] of Object.entries(this.responses)) {
      this.io.value(key, value);
    }

    if (this.responses.confirmation) {
      this.io.success("\nGenerating template with selected options...\n");
    } else {
      this.io.error("\nTemplate generation cancelled.\n");
    }
  }

  getResponses(): Record<string, any> {
    return this.responses;
  }

  getResponse(name: string): any {
    return this.responses[name];
  }
}

const snpy = new Snpy();

snpy.addOption({
  type: "list",
  name: "framework",
  message: "Choose a framework:",
  choices: [
    "React",
    "Vue",
    "Angular",
    "Svelte",
    "MySQL",
    "PostgreSQL",
    "MongoDB",
    "Redis",
    "Authentication",
    "API Integration",
    "File Upload",
    "Real-time Updates",
  ],
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
  type: "directory",
  name: "targetDir",
  message: "Choose target directory",
  basePath: ".",
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
