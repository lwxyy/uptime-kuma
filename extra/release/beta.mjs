import "dotenv/config";
import {
    ver,
    buildDist,
    buildImage,
    checkDocker,
    checkTagExists,
    checkVersionFormat,
    getRepoNames,
    execSync,
    checkReleaseBranch,
    createDistTarGz,
    createReleasePR,
} from "./lib.mjs";
import semver from "semver";

const repoNames = getRepoNames();
const version = process.env.RELEASE_BETA_VERSION;
const dryRun = process.env.DRY_RUN === "true";
const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;
const branchName = `release-${version}`;
const githubRunId = process.env.GITHUB_RUN_ID;

if (dryRun) {
    console.log("Dry run mode enabled. No images will be pushed.");
}

console.log("RELEASE_BETA_VERSION:", version);

// Check if the current branch is "release-{version}"
checkReleaseBranch(branchName);

// Check if the version is a valid semver
checkVersionFormat(version);

// Check if the semver identifier is "beta"
const semverIdentifier = semver.prerelease(version);

// Build steps...
// Build slim image (uses custom BASE_IMAGE) — changed to your account image
buildImage(repoNames, ["beta-slim", ver(version, "slim")], "release", "BASE_IMAGE=lwxyy/uptime-kuma:base2-slim");

// Build full image
buildImage(repoNames, ["beta", version], "release");
} else {
    console.log("Dry run mode - skipping image build and push.");
}

// Create dist.tar.gz
await createDistTarGz();
