#!/bin/bash

# This script extracts the build information from the webinterface

timestamp=$(date "+%a %b %d %Y %H:%M:%S GMT%z (%Z)")

version=$(node -pe "require('./package.json').version")
git_commit=$(cat .git/$(cat .git/HEAD | cut -d' ' -f2))
git_branch=$(cat .git/HEAD | cut -d'/' -f3)

build_info="
const build = {
    version: \"${version}\",
    timestamp: \"${timestamp}\",
    message: null,
    git: {
        branch: \"${git_branch}\",
        hash: \"${git_commit:0:8}\"
    }
};

export default build;
"

# Write to file
echo "${build_info}" > ./src/build.ts

echo "Wrote Build Info"