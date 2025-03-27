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
const MAX_VISIBLE_ITEMS = 10;

export class Snpy {
  private io = new IO();

  constructor() {}

  async run<T extends SnpyOption>(option: T): Promise<SnpyOptionReturnType<T>> {
    this.io.setRawMode(option.type !== 'input' && option.type !== 'confirm');

    let result: SnpyOptionReturnType<T>;
    switch (option.type) {
      case 'list':
      case 'nlist':
        result = (await this.handleSelectable(option)) as SnpyOptionReturnType<T>;
        break;
      case 'checkbox':
        result = (await this.handleCheckbox(option)) as SnpyOptionReturnType<T>;
        break;
      case 'confirm':
        result = (await this.handleConfirm(option)) as SnpyOptionReturnType<T>;
        break;
      case 'input':
        result = (await this.handleInput(option)) as SnpyOptionReturnType<T>;
        break;
      case 'directory':
        result = (await this.handleDirectory(option)) as SnpyOptionReturnType<T>;
        break;
      default:
        throw new Error(`Unsupported option type: ${(option as any).type}`);
    }

    this.io.clear();
    return result;
  }

  private getVisibleRange(items: any[], currentIndex: number, maxVisible: number = MAX_VISIBLE_ITEMS) {
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(0, currentIndex - half);
    let end = Math.min(items.length, start + maxVisible);

    if (end === items.length) {
      start = Math.max(0, end - maxVisible);
    }
    if (start === 0) {
      end = Math.min(items.length, maxVisible);
    }

    return { start, end, showTop: start > 0, showBottom: end < items.length };
  }

  private async handleSelectable(option: SnpyOptionList) {
    let currentIndex = 0;
    const choices = option.choices || [];
    let selectedValue = '';

    const render = () => {
      const { start, end, showTop, showBottom } = this.getVisibleRange(choices, currentIndex);
      const visibleChoices = choices.slice(start, end);

      this.io.clear();
      this.io.message(option.message);
      this.io.newLine();

      if (showTop) this.io.hint('   ▲');
      this.io.newLine();

      visibleChoices.forEach((choice, i) => {
        const actualIndex = start + i;
        const prefix = option.type === 'nlist' ? `${actualIndex + 1}) ` : '';
        this.io.choice(choice, actualIndex === currentIndex, prefix);
        this.io.newLine();
      });

      if (showBottom) this.io.hint('   ▼');
      this.io.newLine();
      this.io.hint('\n(Enter to confirm)\n');
    };

    return new Promise<string>(resolve => {
      render();

      this.io.onKeyPress((str, key) => {
        if (key.name === 'up') {
          currentIndex = currentIndex > 0 ? currentIndex - 1 : choices.length - 1;
          render();
        } else if (key.name === 'down') {
          currentIndex = currentIndex < choices.length - 1 ? currentIndex + 1 : 0;
          render();
        } else if (key.name === 'return') {
          this.io.removeKeyPressHandler();
          selectedValue = choices[currentIndex] || '';
          this.io.newLine();
          resolve(selectedValue);
        }
      });
    });
  }

  private async handleCheckbox(option: SnpyOptionCheckbox) {
    let currentIndex = 0;
    const choices = option.choices || [];
    const selectedItems = new Set<number>();

    const render = () => {
      const { start, end, showTop, showBottom } = this.getVisibleRange(choices, currentIndex);
      const visibleChoices = choices.slice(start, end);

      this.io.clear();
      this.io.message(option.message);
      this.io.newLine();

      if (showTop) this.io.hint('   ▲');
      this.io.newLine();

      visibleChoices.forEach((choice, i) => {
        const actualIndex = start + i;
        const isSelected = selectedItems.has(actualIndex);
        const marker = isSelected ? '⬢' : '⬡';
        this.io.choice(choice, actualIndex === currentIndex, marker + '  ');
        this.io.newLine();
      });

      if (showBottom) this.io.hint('   ▼');
      this.io.newLine();
      this.io.hint('\n(Space to select, Enter to confirm)\n');
    };

    return new Promise<string[]>(resolve => {
      render();

      this.io.onKeyPress((str, key) => {
        if (key.name === 'up') {
          currentIndex = currentIndex > 0 ? currentIndex - 1 : choices.length - 1;
          render();
        } else if (key.name === 'down') {
          currentIndex = currentIndex < choices.length - 1 ? currentIndex + 1 : 0;
          render();
        } else if (key.name === 'space') {
          if (selectedItems.has(currentIndex)) {
            selectedItems.delete(currentIndex);
          } else {
            selectedItems.add(currentIndex);
          }
          render();
        } else if (key.name === 'return') {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          const selectedChoices = Array.from(selectedItems)
            .sort()
            .map(index => choices[index] || '');
          resolve(selectedChoices);
        }
      });
    });
  }

  private async handleInput(option: SnpyOptionInput) {
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
          if (!hasInput) hasInput = true;
          input += str;
          resetLine();
        }
      });
    });
  }

  private async handleConfirm(option: SnpyOptionConfirm) {
    const defaultValue = option.default === undefined ? 'Y' : option.default ? 'Y' : 'N';
    const choices = defaultValue === 'Y' ? 'Y/n' : 'y/N';
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
        if (key.name === 'return') {
          this.io.removeKeyPressHandler();
          this.io.newLine();
          resolve((input || defaultValue).toLowerCase() === 'y');
        } else if (key.name === 'backspace') {
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
          resetLine();
        } else if (str && !key.ctrl && !key.meta) {
          const char = str.toLowerCase();
          if (char === 'y' || char === 'n') {
            if (!hasInput) hasInput = true;
            input = char;
            resetLine();
          }
        }
      });
    });
  }

  private getDirectories(source: string) {
    return fs
      .readdirSync(source, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  private async handleDirectory(option: SnpyOptionDirectory) {
    let currentPath = option.basePath || '.';
    let currentIndex = 0;

    const getChoices = () => {
      const dirs = this.getDirectories(currentPath);
      const choices = [SELECT_THIS_PATH];
      if (currentPath !== (option.basePath || '.')) {
        choices.push(SELECT_BACK_PATH);
      }
      return [...choices, ...dirs];
    };

    const createNewFolder = async (): Promise<boolean> => {
      this.io.removeKeyPressHandler();
      this.io.clear();
      this.io.message(option.message + '\n');
      this.io.message('Current path: ' + currentPath + '\n');

      this.io.setRawMode(false);
      const folderName = await this.handleInput({
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
          this.logError('\nFolder already exists!\n');
          await new Promise(resolve => setTimeout(resolve, 1500));
          this.io.setRawMode(true);
          return false;
        }

        fs.mkdirSync(newPath);
        currentPath = newPath;
        this.io.setRawMode(true);
        return true;
      } catch (error) {
        this.logError('\nFailed to create folder!\n');
        await new Promise(resolve => setTimeout(resolve, 1500));
        this.io.setRawMode(true);
        return false;
      }
    };

    const render = () => {
      const choices = getChoices();
      const { start, end, showTop, showBottom } = this.getVisibleRange(choices, currentIndex);
      const visibleChoices = choices.slice(start, end);

      this.io.clear();
      this.io.message(`${option.message}\nCurrent path: ${currentPath}\n`);

      if (showTop) this.io.hint('   ▲');
      this.io.newLine();

      visibleChoices.forEach((choice, i) => {
        const actualIndex = start + i;
        const prefix = choice === SELECT_THIS_PATH ? '' : choice === SELECT_BACK_PATH ? '📂 ' : '📁 ';
        this.io.choice(choice, actualIndex === currentIndex, prefix);
        this.io.newLine();
      });

      if (showBottom) this.io.hint('   ▼');
      this.io.newLine();
      this.io.hint('\n(Enter to select, Space to create new folder, Backspace to go up)\n');
    };

    return new Promise<string>(resolve => {
      const keyPressHandler = (str: string, key: any) => {
        const choices = getChoices();
        switch (key.name) {
          case 'up':
            currentIndex = currentIndex > 0 ? currentIndex - 1 : choices.length - 1;
            render();
            break;
          case 'down':
            currentIndex = currentIndex < choices.length - 1 ? currentIndex + 1 : 0;
            render();
            break;
          case 'space':
            createNewFolder().then(success => {
              if (success) {
                currentIndex = 0;
              }
              render();
              this.io.onKeyPress(keyPressHandler);
            });
            break;
          case 'return': {
            const selected = choices[currentIndex];
            if (selected === SELECT_THIS_PATH) {
              this.io.removeKeyPressHandler();
              this.io.newLine();
              resolve(currentPath);
            } else if (selected === SELECT_BACK_PATH) {
              currentPath = path.dirname(currentPath);
              currentIndex = 0;
              render();
            } else {
              currentPath = path.join(currentPath, selected);
              currentIndex = 0;
              render();
            }
            break;
          }
          case 'backspace':
            if (currentPath !== (option.basePath || '.')) {
              currentPath = path.dirname(currentPath);
              currentIndex = 0;
              render();
            }
            break;
        }
      };

      render();
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
      this.logError('[Snpy-Error] Folder already exists!');
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
      this.logError(`[Snpy-Error] File already exists: ${filePath}`);
      return;
    }
    try {
      fs.writeFileSync(filePath, code, 'utf-8');
    } catch (error) {
      this.logError(`[Snpy-Error] Failed to write file: ${filePath}`);
    }
  }
}
