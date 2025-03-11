import { Snpy } from "./snpy";

const template = (component_name: string) => {
  return `<templat2e>
    ${component_name}
    </templat2e>`;
};

(async () => {
  await Snpy.prompt(async (snpy) => {
    const component_name = await snpy.runOption({
      type: "input",
      name: "component_name",
      message: "Enter component name",
      default: "Component",
    });

    const targetDir = await snpy.runOption({
      type: "directory",
      name: "targetDir",
      message: "Choose target directory",
      basePath: ".",
    });

    const framework = await snpy.runOption({
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

    const database = await snpy.runOption({
      type: "nlist",
      name: "database",
      message: "Choose a database:",
      choices: ["MySQL", "PostgreSQL", "MongoDB", "Redis"],
    });

    const features = await snpy.runOption({
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

    const projectName = await snpy.runOption({
      type: "input",
      name: "projectName",
      message: "Enter your project name",
      default: "my-awesome-project",
    });

    const typescript = await snpy.runOption({
      type: "confirm",
      name: "typescript",
      message: "Would you like to use TypeScript?",
      default: true,
    });

    const confirmation = await snpy.runOption({
      type: "confirm",
      name: "confirmation",
      message: "Do you want to proceed with these settings?",
    });

    const file_name = `${component_name}.ts`;
    const tmpl = template(component_name);

    snpy.makeTemplate({
      dir: targetDir,
      file_name,
      code: tmpl,
    });
  });
})();
