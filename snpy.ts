import * as fs from 'fs';
import * as path from 'path';
import IO from './io';

interface SnpyOptionBase<T> {
  name: string;
  message: string;
  basePath?: string;
  choices?: string[];
  default?: T;
}

interface SnpyOptionWithType<T, U extends string> extends SnpyOptionBase<T> {
  type: U;
}

export type SnpyOptionDirectory = SnpyOptionWithType<string, 'directory'>;
export type SnpyOptionInput = SnpyOptionWithType<string, 'input'>;
export type SnpyOptionConfirm = SnpyOptionWithType<boolean, 'confirm'>;
export type SnpyOptionCheckbox = SnpyOptionWithType<string[], 'checkbox'>;
export type SnpyOptionList = SnpyOptionWithType<string, 'list' | 'nlist'>;

export type SnpyOption =
  | SnpyOptionDirectory
  | SnpyOptionInput
  | SnpyOptionConfirm
  | SnpyOptionCheckbox
  | SnpyOptionList;

interface SnpyOptionTypeMap {
  directory: string;
  input: string;
  confirm: boolean;
  checkbox: string[];
  list: string;
  nlist: string;
}

type SnpyOptionReturnType<T extends SnpyOption> = T extends { type: keyof SnpyOptionTypeMap }
  ? SnpyOptionTypeMap[T['type']]
  : never;

const SELECT_THIS_PATH = '[ SELECT THIS PATH ]';
const SELECT_BACK_PATH = '..';

export class Snpy {
  private io = new IO();

  constructor() {}

  async run<T extends SnpyOption>(option: T): Promise<SnpyOptionReturnType<T>> {
    let result: SnpyOptionReturnType<T>;

    switch (option.type) {
      case 'list':
      case 'nlist':
        this.io.setRawMode(true);
        result = (await this.askSelectable(option)) as SnpyOptionReturnType<T>;
        break;
      case 'checkbox':
        this.io.setRawMode(true);
        result = (await this.askCheckbox(option)) as SnpyOptionReturnType<T>;
        break;
      case 'confirm':
        this.io.setRawMode(false);
        result = (await this.askConfirm(option)) as SnpyOptionReturnType<T>;
        break;
      case 'input':
        this.io.setRawMode(false);
        result = (await this.askInput(option)) as SnpyOptionReturnType<T>;
        break;
      case 'directory':
        this.io.setRawMode(true);
        result = (await this.askDirectory(option)) as SnpyOptionReturnType<T>;
        break;
      default:
        throw new Error(`Unsupported option type: ${(option as SnpyOptionWithType<any, any>).type}`);
    }

    this.io.clear();
    return result;
  }

  private getVisibleChoices<T>(items: T[], currentIndex: number, maxVisible: number = 10) {
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(0, currentIndex - half);
    let end = Math.min(items.length, start + maxVisible);

    if (end === items.length) {
      start = Math.max(0, end - maxVisible);
    }
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

  private async askSelectable(option: SnpyOption) {
    this.io.message(option.message);
    let currentIndex = 0;

    const printChoices = () => {
      this.io.clear();
      this.io.message(option.message);

      const choices = option.choices || [];
      const { start, end, showTop, showBottom } = this.getVisibleChoices(choices, currentIndex);
      const visibleChoices = choices.slice(start, end);

      const needsScroll = showTop || showBottom;

      this.io.newLine();
      if (needsScroll && showTop) {
        this.io.hint('   ▲');
      }
      this.io.newLine();

      const targetLines = needsScroll ? 10 : choices.length;
      for (let i = 0; i < targetLines; i++) {
        if (i < visibleChoices.length) {
          const choice = visibleChoices[i];
          const actualIndex = start + i;
          const prefix = option.type === 'nlist' ? `${actualIndex + 1}) ` : '';
          if (actualIndex === currentIndex) {
            this.io.choice(choice, true, prefix);
          } else {
            this.io.choice(choice, false, prefix);
          }
        }
        this.io.newLine();
      }

      if (needsScroll && showBottom) {
        this.io.hint('   ▼');
      }
      this.io.newLine();
    };

    return new Promise<string>(resolve => {
      printChoices();

      this.io.onKeyPress((str, key) => {
        if (key.ctrl && key.name === 'c') {
          process.exit();
        } else if (key.name === 'up') {
          currentIndex = currentIndex > 0 ? currentIndex - 1 : (option.choices?.length || 1) - 1;
          printChoices();
        } else if (key.name === 'down') {
          currentIndex = currentIndex < (option.choices?.length || 1) - 1 ? currentIndex + 1 : 0;
          printChoices();
        } else if (key.name === 'return') {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          resolve(option.choices?.[currentIndex] || '');
        }
      });
    });
  }

  private async askCheckbox(option: SnpyOption) {
    this.io.message(option.message);
    let currentIndex = 0;
    const selectedItems = new Set<number>();

    const printChoices = () => {
      this.io.clear();
      this.io.message(option.message);

      const choices = option.choices || [];
      const { start, end, showTop, showBottom } = this.getVisibleChoices(choices, currentIndex);
      const visibleChoices = choices.slice(start, end);

      const needsScroll = showTop || showBottom;

      this.io.newLine();
      if (needsScroll && showTop) {
        this.io.hint('   ▲');
      }
      this.io.newLine();

      const targetLines = needsScroll ? 10 : choices.length;
      for (let i = 0; i < targetLines; i++) {
        if (i < visibleChoices.length) {
          const choice = visibleChoices[i];
          const actualIndex = start + i;
          const isSelected = selectedItems.has(actualIndex);
          const marker = isSelected ? '⬢' : '⬡';
          if (actualIndex === currentIndex) {
            this.io.choice(choice, true, marker + '  ');
          } else {
            this.io.choice(choice, false, marker + '  ');
          }
        }
        this.io.newLine();
      }

      if (needsScroll && showBottom) {
        this.io.hint('   ▼');
      }
      this.io.newLine();
      this.io.hint('\n(Space to select, Enter to confirm)\n');
    };

    return new Promise<string[]>(resolve => {
      printChoices();

      this.io.onKeyPress((str, key) => {
        if (key.ctrl && key.name === 'c') {
          process.exit();
        } else if (key.name === 'up') {
          currentIndex = currentIndex > 0 ? currentIndex - 1 : (option.choices?.length || 1) - 1;
          printChoices();
        } else if (key.name === 'down') {
          currentIndex = currentIndex < (option.choices?.length || 1) - 1 ? currentIndex + 1 : 0;
          printChoices();
        } else if (key.name === 'space') {
          if (selectedItems.has(currentIndex)) {
            selectedItems.delete(currentIndex);
          } else {
            selectedItems.add(currentIndex);
          }
          printChoices();
        } else if (key.name === 'return') {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          const selectedChoices = Array.from(selectedItems)
            .sort()
            .map(index => option.choices?.[index] || '');
          resolve(selectedChoices);
        }
      });
    });
  }

  private async askInput(option: SnpyOption) {
    const prompt = `${option.message}: `;
    const defaultValue = option.default?.toString() || '';

    this.io.clear();
    this.io.prompt(prompt);

    return new Promise<string>(resolve => {
      let input = '';
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
        if (key.ctrl && key.name === 'c') {
          process.exit();
        }

        if (key.name === 'return') {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          resolve(input || defaultValue);
        } else if (key.name === 'backspace') {
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
          resetLine();
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

  private async askConfirm(option: SnpyOption) {
    const defaultValue =
      option.default === undefined ? 'Y' : option.default === true ? 'Y' : option.default === false ? 'N' : 'Y';

    const choices = defaultValue.toLowerCase() === 'y' ? 'Y/n' : 'y/N';
    const prompt = `${option.message} (${choices}): `;

    this.io.clear();
    this.io.prompt(prompt);

    return new Promise<boolean>(resolve => {
      let input = '';
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
        if (key.ctrl && key.name === 'c') {
          process.exit();
        }

        if (key.name === 'return') {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          const finalValue = input || defaultValue;
          resolve(finalValue.toLowerCase() === 'y');
        } else if (key.name === 'backspace') {
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
          resetLine();
        } else if (str && !key.ctrl && !key.meta) {
          const char = str.toLowerCase();
          if (char === 'y' || char === 'n') {
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

  private getDirectories(source: string) {
    return fs
      .readdirSync(source, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  private async askDirectory(option: SnpyOption) {
    let currentPath = option.basePath || '.';

    const getChoices = (dirPath: string): string[] => {
      const dirs = this.getDirectories(dirPath);
      const choices = [SELECT_THIS_PATH];

      if (currentPath !== (option.basePath || '.')) {
        choices.push(SELECT_BACK_PATH);
      }

      return [...choices, ...dirs];
    };

    const printChoices = (choices: string[], currentIndex: number) => {
      this.io.clear();
      this.io.message(option.message + '\n');
      this.io.message('Current path: ' + currentPath + '\n');

      const { start, end, showTop, showBottom } = this.getVisibleChoices(choices, currentIndex);
      const visibleChoices = choices.slice(start, end);

      const needsScroll = showTop || showBottom;

      this.io.newLine();
      if (needsScroll && showTop) {
        this.io.hint('   ▲');
      }
      this.io.newLine();

      const targetLines = needsScroll ? 10 : choices.length;
      for (let i = 0; i < targetLines; i++) {
        if (i < visibleChoices.length) {
          const choice = visibleChoices[i];
          const actualIndex = start + i;
          if (actualIndex === currentIndex) {
            this.io.choice(
              choice,
              true,
              choice === SELECT_THIS_PATH ? '' : choice === SELECT_BACK_PATH ? '📂 ' : '📁 ',
            );
          } else {
            this.io.choice(
              choice,
              false,
              choice === SELECT_THIS_PATH ? '' : choice === SELECT_BACK_PATH ? '📂 ' : '📁 ',
            );
          }
        }
        this.io.newLine();
      }

      if (needsScroll && showBottom) {
        this.io.hint('   ▼');
      }
      this.io.newLine();
      this.io.hint('\n(Enter to select, Backspace to go up)\n');
    };

    const createNewFolder = async () => {
      this.io.removeKeyPressHandler();

      this.io.clear();
      this.io.message(option.message + '\n');
      this.io.message('Current path: ' + currentPath + '\n\n');

      this.io.setRawMode(false);
      const folderName = await this.askInput({
        type: 'input',
        name: 'newFolder',
        message: 'Enter new folder name',
      });

      if (!folderName) {
        this.io.setRawMode(true);
        return false;
      }

      try {
        const newPath = path.join(currentPath, folderName);
        if (fs.existsSync(newPath)) {
          this.io.error('\nFolder already exists!\n');
          await new Promise(resolve => setTimeout(resolve, 1500));
          this.io.setRawMode(true);
          return false;
        }

        fs.mkdirSync(newPath);
        currentPath = newPath;
        this.io.setRawMode(true);
        return true;
      } catch (error) {
        this.io.error('\nFailed to create folder!\n');
        await new Promise(resolve => setTimeout(resolve, 1500));
        this.io.setRawMode(true);
        return false;
      }
    };

    return new Promise<string>(resolve => {
      let currentIndex = 0;
      let choices = getChoices(currentPath);

      const handleNavigation = () => {
        printChoices(choices, currentIndex);
      };

      handleNavigation();

      const keyPressHandler = (str: string, key: any) => {
        if (key.ctrl && key.name === 'c') {
          process.exit();
        } else if (key.name === 'up') {
          currentIndex = currentIndex > 0 ? currentIndex - 1 : choices.length - 1;
          handleNavigation();
        } else if (key.name === 'down') {
          currentIndex = currentIndex < choices.length - 1 ? currentIndex + 1 : 0;
          handleNavigation();
        } else if (key.name === 'space') {
          createNewFolder().then(success => {
            if (success) {
              choices = getChoices(currentPath);
              currentIndex = 0;
            }
            this.io.onKeyPress(keyPressHandler);
            handleNavigation();
          });
        } else if (key.name === 'return') {
          const selected = choices[currentIndex];

          if (selected === SELECT_THIS_PATH) {
            this.io.removeKeyPressHandler();
            this.io.newLine();
            resolve(currentPath);
          } else if (selected === SELECT_BACK_PATH) {
            if (currentPath !== (option.basePath || '.')) {
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
        } else if (key.name === 'backspace') {
          if (currentPath !== (option.basePath || '.')) {
            currentPath = path.dirname(currentPath);
            choices = getChoices(currentPath);
            currentIndex = 0;
            handleNavigation();
          }
        }
      };
      this.io.onKeyPress(keyPressHandler);
    });
  }

  log(message: string) {
    this.io.message(message);
    this.io.newLine();
  }

  logSuccess(message: string) {
    this.io.success(message);
    this.io.newLine();
  }

  logError(message: string) {
    this.io.error(message);
    this.io.newLine();
  }

  logHint(message: string) {
    this.io.hint(message);
    this.io.newLine();
  }

  makeFolder(currentPath: string, folderName: string) {
    const newPath = path.join(currentPath, folderName);
    if (fs.existsSync(newPath)) {
      this.io.error('\nFolder already exists!\n');
      return false;
    }
    fs.mkdirSync(newPath);
    return newPath;
  }

  exit() {
    this.io.exit();
  }

  static async prompt(callback: (snpy: Snpy) => Promise<void>) {
    const snpy = new Snpy();
    try {
      await callback(snpy);
    } finally {
      snpy.exit();
    }
  }

  makeTemplate({ dir, file_name, code }: { dir: string; file_name: string; code: string }) {
    const filePath = path.join(dir, file_name);

    if (fs.existsSync(filePath)) {
      this.io.error(`[Snpy-Error] File already exists: ${filePath}`);
      return;
    }

    try {
      fs.writeFileSync(filePath, code, 'utf-8');
    } catch (error: any) {
      this.io.error(`[Snpy-Error] Failed to write file : ${filePath}`);
    }
  }
}
