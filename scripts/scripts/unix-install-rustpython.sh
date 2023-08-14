#!/usr/bin/env bash

# sha256sum of the files available to download. This is a hack for a proof of concept.
# d5e2428a0993351e3ebdcd5dfe37a37efbac42429d0f810d497d6f69425f7722  deno/deno-aarch64-apple-darwin
# 8f048a80bba1fb1f00d9b20469010d589883fce0709771b5eb6bed8e5202616c  deno/deno-x86_64-apple-darwin
# 89f9945b60c03e45bbe9b8922615062cedb20fb0549769107f7951fe133a4028  deno/deno-x86_64-pc-windows-msvc.exe
# 95e06702c7d10f9fb18d634477c11af75e8e0d6b6ccb8c008b6cdc6d376c721f  deno/deno-x86_64-unknown-linux-gnu
# 352790c485c7eadec7f1c7128b04ba533bb3c905aa1c20fbb327297f058200e3  nushell/nu-aarch64-apple-darwin
# f92a3a58c81de5424e5005cbeee2411d99164d07de2e8e0371fd1816f373e3bf  nushell/nu-x86_64-pc-windows-msvc.exe
# fb0147ed7619c88fe2f0c7f24f5502bf391345869fdbf2e660258c5376757e6b  nushell/nu-x86_64-unknown-linux-musl
# 49523dcc0527a113db47cbcee55c3838b447d1c55a1ef89a1caf4ac413314a1a  rustpython/rustpython-aarch64-apple-darwin
# fd2783feb3d4b096ea305f7432fcd142fa7e9ba9a55e07085ba36345495e7189  rustpython/rustpython-x86_64-pc-windows-gnu.exe
# 09c65faec69733acc52ffed78d23f09281f1e9bd055cc62247254c1ec06fb126  rustpython/rustpython-x86_64-unknown-linux-gnu

declare -A hash
hash["deno-aarch64-apple-darwin"]="d5e2428a0993351e3ebdcd5dfe37a37efbac42429d0f810d497d6f69425f7722"
hash["deno-x86_64-apple-darwin"]="d5e2428a0993351e3ebdcd5dfe37a37efbac42429d0f810d497d6f69425f7722"
hash["deno-x86_64-unknown-linux-gnu"]="95e06702c7d10f9fb18d634477c11af75e8e0d6b6ccb8c008b6cdc6d376c721f"
hash["nu-aarch64-apple-darwin"]="352790c485c7eadec7f1c7128b04ba533bb3c905aa1c20fbb327297f058200e3"
hash["nu-x86_64-unknown-linux-musl"]="fb0147ed7619c88fe2f0c7f24f5502bf391345869fdbf2e660258c5376757e6b"
hash["rustpython-aarch64-apple-darwin"]="49523dcc0527a113db47cbcee55c3838b447d1c55a1ef89a1caf4ac413314a1a"
hash["rustpython-x86_64-unknown-linux-gnu"]="09c65faec69733acc52ffed78d23f09281f1e9bd055cc62247254c1ec06fb126"

# Where to install the binaries.
BASE_DIR="/opt/exec-wrapper"
DL_URL="https://niceguyit.biz/exec-wrapper/"

mkdir --parents "${BASE_DIR}/bin"

arch=$(uname -m | tr '[:upper:]' '[:lower:]')
os=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$os" in
  darwin)
    filename="rustpython-${arch}-apple-${os}"
    ;;
  linux)
    filename="rustpython-${arch}-unknown-${os}-gnu"
    ;;
  *)
    echo "Unknown OS: ${os}"
    exit 1
    ;;
esac

if [[ -f "${BASE_DIR}/bin/rustpython" ]] && echo "${hash[$filename]}  ${BASE_DIR}/bin/rustpython" | sha256sum --check; then
  echo "Existing file hash does not match. Deleting file to force the download."
  rm "${BASE_DIR}/bin/rustpython"
fi

if [[ ! -f "${BASE_DIR}/bin/rustpython" ]]; then
  curl --location --output "${BASE_DIR}/bin/rustpython" "${DL_URL}${filename}"
fi


