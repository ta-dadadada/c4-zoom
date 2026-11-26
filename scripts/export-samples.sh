#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
repo_root=$(pwd -P)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
trap 'exit 1' HUP INT TERM

cli=${STRUCTURIZR_CLI:-}
if [ -z "$cli" ]; then
  cli=$(command -v structurizr || command -v structurizr.sh || command -v structurizr-cli || true)
fi
if [ -z "$cli" ] && ! command -v docker >/dev/null 2>&1; then
  echo 'structurizr、STRUCTURIZR_CLI、Docker のいずれかを利用してください。' >&2
  exit 1
fi

export_workspace() {
  input=$1
  target=$2
  output=$(mktemp -d "$stage/export.XXXXXX")
  if [ -n "$cli" ]; then
    "$cli" export -workspace "$input" -format json -output "$output"
  else
    docker run --rm --network none --user "$(id -u):$(id -g)" \
      -v "$repo_root:/usr/local/structurizr:ro" -v "$output:/out" \
      "${STRUCTURIZR_CLI_IMAGE:-structurizr/structurizr:latest}" \
      export -workspace "$input" -format json -output /out
  fi
  # 公式 CLI が処理エラー時に成功終了する版もあるため、成果物を確認する。
  source_name=$(basename "$input" .dsl)
  if [ ! -s "$output/$source_name.json" ]; then
    echo "$input の変換で $source_name.json が生成されませんでした。" >&2
    exit 1
  fi
  mkdir -p "$stage/$(dirname "$target")"
  mv "$output/$source_name.json" "$stage/$target"
}

export_workspace docs/architecture/workspace.dsl docs/architecture/workspace.json
for input in fixtures/dsl/upstream/*.dsl fixtures/dsl/custom/*.dsl; do
  case "$input" in
    # 異常系 DSL と外部のアプリケーション JAR を参照するサンプルは変換しない。
    */invalid-syntax.dsl | */spring-petclinic.dsl) continue ;;
  esac
  target="fixtures/json/${input#fixtures/dsl/}"
  export_workspace "$input" "${target%.dsl}.json"
done

find "$stage/docs" "$stage/fixtures" -type f -name '*.json' | while IFS= read -r file; do
  target=${file#"$stage/"}
  mkdir -p "$(dirname "$target")"
  cp "$file" "$target"
done
