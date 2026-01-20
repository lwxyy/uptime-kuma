import "dotenv/config";
import * as childProcess from "child_process";
import semver from "semver";
import { generateChangelog } from "../generate-changelog.mjs";
import fs from "fs";
import tar from "tar";

export const dryRun = process.env.RELEASE_DRY_RUN === "1";

if (dryRun) {
    console.info("Dry run enabled.");
}

/**
 * Check if docker is running
 * @returns {void}
 */
export function checkDocker() {
    try {
        childProcess.execSync("docker ps");
    } catch (error) {
        console.error("Docker is not running. Please start docker and try again.");
        process.exit(1);
    }
}

/**
 * Get Docker Hub repository name
 * @returns {string[]} List of repository names
 */
export function getRepoNames() {
    if (process.env.RELEASE_REPO_NAMES) {
        // Split by comma
        return process.env.RELEASE_REPO_NAMES.split(",").map((name) => name.trim());
    }
    // Updated default to your account
    return ["lwxyy/uptime-kuma", "ghcr.io/lwxyy/uptime-kuma"];
}

/**
 * Build frontend dist
 * @returns {void}
 */
export function buildDist() {
    if (!dryRun) {
        childProcess.execSync("npm run build", { stdio: "inherit" });
    } else {
        console.info("[DRY RUN] npm run build");
    }
}

/**
 * Build docker image and push to Docker Hub
 * @param {string[]} repoNames Docker Hub repository names
 * @param {string[]} tags Docker image tags
 * @param {string} target Dockerfile's target name
 * @param {string} buildArgs Docker build args
 * @param {string} dockerfile Path to Dockerfile
 */
export function buildImage(
    repoNames,
    tags,
    target,
    buildArgs = "",
    dockerfile = "docker/dockerfile",
    platform = "linux/amd64,linux/arm64,linux/arm/v7"
) {
    let args = ["buildx", "build", "-f", dockerfile, "--platform", platform];

    for (let repoName of repoNames) {
        // Add tags
        for (let tag of tags) {
            args.push("-t", `${repoName}:${tag}`);
        }
    }

    args = [...args, "--target", target];

    // Add build args
    if (buildArgs) {
        args.push("--build-arg", buildArgs);
    }

    args = [...args, ".", "--push"];

    if (!dryRun) {
        childProcess.spawnSync("docker", args, { stdio: "inherit" });
    } else {
        console.log(`[DRY RUN] docker ${args.join(" ")}`);
    }
}

/**
 * Check if the version already exists on Docker Hub
 * TODO: use semver to compare versions if it is greater than the previous?
 * @param {string[]} repoNames repository name (Only check the name with single slash)
 * @param {string} version Version to check
 * @returns {void}
 */
export async function checkTagExists(repoNames, version) {
    // Skip if the tag is not on Docker Hub
    // louislam/uptime-kuma
    let dockerHubRepoNames = repoNames.filter((name) => {
        return name.split("/").length === 2;
    });

    for (let repoName of dockerHubRepoNames) {
        await checkTagExistsSingle(repoName, version);
    }
}

/**
 * Check if the version already exists on Docker Hub
 * @param {string} repoName repository name
 * @param {string} version Version to check
 * @returns {Promise<void>}
 */
export async function checkTagExistsSingle(repoName, version) {
    console.log(`Checking if version ${version} exists on Docker Hub:`, repoName);

    // Get a list of tags from the Docker Hub repository
    let tags = [];

    // It is mainly to check my careless mistake that I forgot to update the release version in .env, so `page_size` is set to 100 is enough, I think.
    const response = await fetch(`https://hub.docker.com/v2/repositories/${repoName}/tags/?page_size=100`);
    if (response.ok) {
        const data = await response.json();
        tags = data.results.map((tag) => tag.name);
    } else {
        console.error("Failed to get tags from Docker Hub");
        process.exit(1);
    }

    // Check if the version already exists
    if (tags.includes(version)) {
        console.error(`Version ${version} already exists`);
        process.exit(1);
    }
}

/**
 * Check the version format
 * @param {string} version Version to check
 */
