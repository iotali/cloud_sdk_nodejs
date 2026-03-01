#!/usr/bin/env bash
set -euo pipefail

REPO="iotali/cloud_sdk_nodejs"
TAG="master"
TARGET_DIR="${HOME}/.openclaw/skills/my-iot-generic-tool"
SKILL_SUBDIR="skills/openclaw-iot-generic-skill"
FORCE="false"
RUN_NPM_INSTALL="true"

print_usage() {
	cat <<'EOF'
Usage:
  bash install.sh [--tag <tag-or-branch>] [--target <dir>] [--repo <owner/repo>] [--force] [--no-install]

Options:
  --tag         Git tag or branch to install from (default: master)
  --target      Target skill directory (default: ~/.openclaw/skills/my-iot-generic-tool)
  --repo        GitHub repository (default: iotali/cloud_sdk_nodejs)
  --force       Overwrite existing target directory
  --no-install  Skip npm install
  -h, --help    Show this help message

Examples:
  bash install.sh --tag v1.1.1
  bash install.sh --tag master --target ~/.openclaw/skills/iot-generic --force
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--tag)
		TAG="${2:-}"
		shift 2
		;;
	--target)
		TARGET_DIR="${2:-}"
		shift 2
		;;
	--repo)
		REPO="${2:-}"
		shift 2
		;;
	--force)
		FORCE="true"
		shift
		;;
	--no-install)
		RUN_NPM_INSTALL="false"
		shift
		;;
	-h | --help)
		print_usage
		exit 0
		;;
	*)
		echo "Unknown option: $1" >&2
		print_usage
		exit 1
		;;
	esac
done

if [[ -z "${TAG}" ]]; then
	echo "Error: --tag cannot be empty" >&2
	exit 1
fi

for cmd in curl tar mktemp; do
	if ! command -v "${cmd}" >/dev/null 2>&1; then
		echo "Error: '${cmd}' is required but not installed." >&2
		exit 1
	fi
done

if [[ "${RUN_NPM_INSTALL}" == "true" ]] && ! command -v npm >/dev/null 2>&1; then
	echo "Error: 'npm' is required but not installed." >&2
	exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
	rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

ARCHIVE_URL="https://github.com/${REPO}/archive/refs/tags/${TAG}.tar.gz"
if [[ "${TAG}" == "master" || "${TAG}" == "main" ]]; then
	ARCHIVE_URL="https://github.com/${REPO}/archive/refs/heads/${TAG}.tar.gz"
fi

echo "Downloading ${ARCHIVE_URL}"
curl -fsSL "${ARCHIVE_URL}" | tar -xz -C "${TMP_DIR}"

EXTRACTED_ROOT="$(ls -1 "${TMP_DIR}" | head -n 1)"
if [[ -z "${EXTRACTED_ROOT}" ]]; then
	echo "Error: failed to extract archive from ${ARCHIVE_URL}" >&2
	exit 1
fi

SOURCE_DIR="${TMP_DIR}/${EXTRACTED_ROOT}/${SKILL_SUBDIR}"
if [[ ! -d "${SOURCE_DIR}" ]]; then
	echo "Error: skill directory not found: ${SKILL_SUBDIR}" >&2
	exit 1
fi

if [[ -e "${TARGET_DIR}" && "${FORCE}" != "true" ]]; then
	echo "Error: target exists: ${TARGET_DIR}" >&2
	echo "Use --force to overwrite." >&2
	exit 1
fi

if [[ -e "${TARGET_DIR}" && "${FORCE}" == "true" ]]; then
	echo "Removing existing target: ${TARGET_DIR}"
	rm -rf "${TARGET_DIR}"
fi

mkdir -p "${TARGET_DIR}"
cp -R "${SOURCE_DIR}/." "${TARGET_DIR}/"

if [[ ! -f "${TARGET_DIR}/.env" && -f "${TARGET_DIR}/.env.example" ]]; then
	cp "${TARGET_DIR}/.env.example" "${TARGET_DIR}/.env"
	echo "Created .env from .env.example"
fi

if [[ "${RUN_NPM_INSTALL}" == "true" ]]; then
	echo "Installing npm dependencies..."
	(
		cd "${TARGET_DIR}"
		npm install
	)
fi

echo
echo "Install complete."
echo "Target: ${TARGET_DIR}"
echo "Next:"
echo "  1) Edit ${TARGET_DIR}/.env"
echo "  2) Run: cd \"${TARGET_DIR}\" && node index.js --action discover --productKey <productKey>"
