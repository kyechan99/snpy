
# Snpy

[![NPM Version](https://img.shields.io/npm/v/snpy?color=%2354c6ff)](https://www.npmjs.com/package/snpy)
[![License: MIT](https://img.shields.io/npm/l/snpy)](https://github.com/kyechan99/snpy/blob/main/LICENSE)
![NPM Type Definitions](https://img.shields.io/npm/types/snpy)

Snpy is a tool for generating templates using various options to gather user input.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
  - [input](#input)
  - [directory](#directory)
  - [list](#list)
  - [nlist](#nlist)
  - [checkbox](#checkbox)
  - [confirm](#confirm)
- [Example](#example)
- [Utilities](#utilities)
  - [makeTemplate](#maketemplate)
  - [makeFolder](#makefolder)
  - [log](#log)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install -D snpy
```

## Usage

```typescript
import { Snpy } from 'snpy';

await Snpy.prompt(async snpy => {
  //...
});
```

## Options

### `input`

Receives a string input.

```typescript
const component_name = await snpy.run({
  type: 'input',
  name: 'component_name',
  message: 'Enter component name',
  default: 'Component',
});
```

### `directory`

Selects a directory.

```typescript
const targetDir = await snpy.run({
  type: 'directory',
  name: 'targetDir',
  message: 'Choose target directory',
  basePath: '.',
});
```

### `list`

Selects one item from a list.

```typescript
const framework = await snpy.run({
  type: 'list',
  name: 'framework',
  message: 'Choose a framework:',
  choices: ['React', 'Vue', 'Angular', 'Svelte'],
});
```

### `nlist`

Selects multiple items from a list.

```typescript
const database = await snpy.run({
  type: 'nlist',
  name: 'database',
  message: 'Choose a database:',
  choices: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis'],
});
```

### `checkbox`

Selects multiple items using checkboxes.

```typescript
const features = await snpy.run({
  type: 'checkbox',
  name: 'features',
  message: 'Select features to include:',
  choices: ['Authentication', 'API Integration', 'File Upload', 'Real-time Updates'],
});
```

### `confirm`

Asks for confirmation.

```typescript
const typescript = await snpy.run({
  type: 'confirm',
  name: 'typescript',
  message: 'Would you like to use TypeScript?',
  default: true,
});
```

## Example

```typescript
import { Snpy } from 'snpy';

const template = (component_name: string) => {
  return `<template>
    ${component_name}
    </template>`;
};

(async () => {
  await Snpy.prompt(async snpy => {
    const component_name = await snpy.run({
      type: 'input',
      name: 'component_name',
      message: 'Enter component name',
      default: 'Button',
    });

    const targetDir = await snpy.run({
      type: 'directory',
      name: 'targetDir',
      message: 'Choose target directory',
      basePath: './src',
    });

    const file_name = `${component_name}.ts`;
    const tmpl = template(component_name);

    snpy.makeTemplate({
      dir: targetDir,
      file_name,
      code: tmpl,
    });

    snpy.logSuccess('Template created successfully.');
  });
})();
```

## Utilities

### `makeTemplate`

Creates a template file.

```typescript
snpy.makeTemplate({
  dir: 'path/to/dir',
  file_name: 'template.ts',
  code: '<template>Component</template>',
});
```

### `makeFolder`

Creates a new folder.

```typescript
const newPath = snpy.makeFolder('path/to/dir', 'newFolder');
snpy.logHint(`Folder created at ${newPath}`);
```

### `log`

Logs a message.

```typescript
snpy.log('This is a log message.');
snpy.logSuccess('Operation completed successfully.');
snpy.logError('An error occurred.');
snpy.logHint('This is a hint.');
```
