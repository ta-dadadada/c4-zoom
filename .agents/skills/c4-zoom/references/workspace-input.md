# Structurizr workspace input

## Convert DSL to workspace JSON

Run the official Structurizr `export` command with `-format json`. Run these examples from the project directory containing `foo.dsl` and its local includes, or adjust the paths to preserve the DSL's relative references.

```sh
structurizr export -workspace foo.dsl -format json -output ./out
```

The local launcher can also be `java -jar structurizr.war` with the same arguments. With Docker, mount the project directory and use paths relative to that mount.

```sh
docker run --rm -v "$PWD:/usr/local/structurizr" structurizr/structurizr \
  export -workspace foo.dsl -format json -output ./out
```

For these commands, expect a newly generated, nonempty `./out/foo.json`. Use the actual basename of the DSL. If the c4-zoom checkout is in a different directory, pass the resulting JSON path relative to that checkout or use its absolute path. [Structurizr export options](https://docs.structurizr.com/export) · [Official binaries](https://docs.structurizr.com/binaries)

## Mapped fields

| Workspace fields                                                                                             | Use in c4-zoom                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Root `name`, `description`                                                                                   | Workspace metadata                                                                                                              |
| `model.people[]`, `model.softwareSystems[]`, `model.customElements[]`                                        | L1 elements                                                                                                                     |
| `containers[]` under a system and `components[]` under a container                                           | L2 and L3 elements                                                                                                              |
| Element `id`, `name`, `description`, `technology`, `tags`, `url`, `properties`, `group`                      | Element identity, details, and grouping. Nested group names use `model.properties["structurizr.groupSeparator"]` (default `/`). |
| Element `relationships[]` with `id`, `sourceId`, and `destinationId`                                         | Edges between supported model elements                                                                                          |
| `views` (including view membership, saved coordinates, and styles), `documentation`, `model.deploymentNodes` | Ignored by the map                                                                                                              |

## Diagnostic severities

| Severity  | Examples                                                                                    | Result                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `error`   | Invalid JSON, a missing or invalid `model`, input limits exceeded                           | Load fails. The viewer retains the previous valid map when available.                                                      |
| `warning` | Duplicate or missing element ID, missing element name, absent `sourceId` or `destinationId` | The invalid entry is skipped. An element with no name is displayed using its ID. The CLI rejects warnings with `--strict`. |
| `info`    | A relationship references an element outside the supported model, such as a deployment node | The relationship is skipped.                                                                                               |
