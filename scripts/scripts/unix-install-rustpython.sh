#!/usr/bin/env bash

# This script will install RustPython and some necessary pip modules for use by the exec-wrapper script.
# There is no uninstall script. If you want to uninstall it, remove the files/directories below.
#
# RustPython install file: /opt/exec-wrapper/bin/rustpython
# Pip install directory: /usr/local/lib/rustpython3.11
# Binary downloaded from: https://NiceGuyIT.biz/exec-wrapper/...
# RustPython: https://github.com/RustPython/RustPython
#
# Arguments:
#   reinstall-pip    Reinstalls the pip modules by deleting /usr/local/lib/rustpython3.11
#

# sha256sum of the files available to download. This is a hack for a proof of concept.
hashes=$(
	cat <<EOT
d5e2428a0993351e3ebdcd5dfe37a37efbac42429d0f810d497d6f69425f7722  deno-aarch64-apple-darwin
8f048a80bba1fb1f00d9b20469010d589883fce0709771b5eb6bed8e5202616c  deno-x86_64-apple-darwin
89f9945b60c03e45bbe9b8922615062cedb20fb0549769107f7951fe133a4028  deno-x86_64-pc-windows-msvc.exe
95e06702c7d10f9fb18d634477c11af75e8e0d6b6ccb8c008b6cdc6d376c721f  deno-x86_64-unknown-linux-gnu
352790c485c7eadec7f1c7128b04ba533bb3c905aa1c20fbb327297f058200e3  nu-aarch64-apple-darwin
f92a3a58c81de5424e5005cbeee2411d99164d07de2e8e0371fd1816f373e3bf  nu-x86_64-pc-windows-msvc.exe
fb0147ed7619c88fe2f0c7f24f5502bf391345869fdbf2e660258c5376757e6b  nu-x86_64-unknown-linux-musl
e53a55d713423072883d74f09e2cf8f92382d5ed41e44ae7871cf011b1b33e0b  rustpython-aarch64-apple-darwin
fd2783feb3d4b096ea305f7432fcd142fa7e9ba9a55e07085ba36345495e7189  rustpython-x86_64-pc-windows-gnu.exe
9064f69151f0f2b7cb11109273ce65a2168ee8256ab2ff847d1f47b51f3d05aa  rustpython-x86_64-unknown-linux-gnu
EOT
)

# Where to install the binaries.
BASE_DIR="/opt/exec-wrapper"
BASE_URL="https://niceguyit.biz/exec-wrapper/"

if [[ ! -d "${BASE_DIR}" ]]; then
	mkdir -p "${BASE_DIR}"
	chmod a+rX "${BASE_DIR}"
fi

if [[ ! -d "${BASE_DIR}/bin" ]]; then
	mkdir -p "${BASE_DIR}/bin"
	chmod a+rX "${BASE_DIR}/bin"
fi

arch=$(uname -m | tr '[:upper:]' '[:lower:]')
os=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$os" in
darwin)
	case "$arch" in
	arm64)
		filename="rustpython-aarch64-apple-${os}"
		;;
	*)
		filename="rustpython-${arch}-apple-${os}"
		;;
	esac
	;;
linux)
	filename="rustpython-${arch}-unknown-${os}-gnu"
	;;
*)
	echo "Unknown OS: ${os}"
	exit 1
	;;
esac

hash=$(echo "${hashes}" | grep "${filename}" | awk "/$filename/ {print \$1;}")
if [[ -f "${BASE_DIR}/bin/rustpython" ]]; then
	if ! (echo "${hash}  ${BASE_DIR}/bin/rustpython" | shasum --algorithm 256 --check); then
		echo "Existing rustpython hash: '${hash}'"
		echo "Existing file hash does not match. Deleting file to force the download."
		rm "${BASE_DIR}/bin/rustpython"
	else
		echo "File exists and hash matches."
	fi
fi

if [[ ! -f "${BASE_DIR}/bin/rustpython" ]]; then
	echo "Downloading rustpython to ${BASE_DIR}/bin/rustpython"
	curl --location --progress-bar --output "${BASE_DIR}/bin/rustpython" "${BASE_URL}${filename}"
	chmod a+rx "${BASE_DIR}/bin/rustpython"
	echo
fi

if [[ -d "/usr/local/lib/rustpython3.11/site-packages/" && "$1" == "reinstall-pip" ]]; then
	echo "Reinstalling the python modules by deleting /usr/local/lib/rustpython3.11/"
	rm -r "/usr/local/lib/rustpython3.11/"
	echo
fi

# The docs say to use '--install-pip' but that doesn't work. '--install-pip get-pip' is needed.
# https://github.com/RustPython/RustPython/issues/4332
# FIXME: I could not find a way to change the default directory for pip.
# Current configuration installs to /usr/local/lib/
if [[ ! -d "/usr/local/lib/rustpython3.11/site-packages/" ]]; then
	echo "/usr/local/lib/rustpython3.11/site-packages/ does not exist. Installing pip."
	"${BASE_DIR}/bin/rustpython" --install-pip get-pip
	echo
fi

echo "Checking if the necessary modules are installed"
if [[ $(/opt/exec-wrapper/bin/rustpython -m pip freeze | grep -Ec "^(requests|chardet)=") -ne 2 ]]; then
	echo "Installing the necessary module with pip"
	"${BASE_DIR}/bin/rustpython" -m pip install requests chardet
	echo
fi

echo "RustPython site-packages are built in. Pip installed packages are located in /usr/local/lib/rustpython3.11"
ls -la /usr/local/lib/rustpython3.11
echo

echo "RustPython is installed to ${BASE_DIR}"
