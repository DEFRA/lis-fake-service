#nullable enable
#load "version.cake"

var target = Argument("target", "Default");
var version = Argument("package_version", EnvironmentVariable("PACKAGE_VERSION") ?? "");

Task("Version")
    .Description("Calculates the package version")
    .Does(() =>
    {
        if (string.IsNullOrWhiteSpace(version))
        {
            version = CalculateVersion();
        }

        Information($"Version {version}");
    });

Task("Install")
    .IsDependentOn("Version")
    .Description("Installs dependencies from package-lock.json")
    .Does(() => RunNpm("ci"));

Task("SecurityAudit")
    .IsDependentOn("Install")
    .Description("Audits dependencies")
    .Does(() => RunNpm("run security-audit"));

Task("Format")
    .IsDependentOn("SecurityAudit")
    .Description("Checks formatting without changing source files")
    .Does(() => RunNpm("run format:check"));

Task("Lint")
    .IsDependentOn("Format")
    .Description("Runs JavaScript linting")
    .Does(() => RunNpm("run lint"));

Task("Test")
    .IsDependentOn("Lint")
    .Description("Runs the Vitest test suite")
    .Does(() => RunNpm("test"));

Task("Build")
    .IsDependentOn("Test")
    .Description("Validates the syntax of source files")
    .Does(() =>
    {
        foreach (var sourceFile in GetFiles("./src/**/*.js"))
        {
            RunNode($"--check \"{sourceFile}\"");
        }
    });

Task("Default")
    .IsDependentOn("Build");

RunTarget(target);
