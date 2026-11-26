import { useEffect, useRef, useState } from 'react';
import { workspaceHash } from '@c4-zoom/core/export';
import { useActions, useAppState } from '../state/AppStateContext';
import { DisplayOptions } from './ZoomControls';
import { downloadHtml } from './downloadHtml';

const severityName = { error: 'エラー', warning: '警告', info: '情報' } as const;

export function SourceControls() {
  const { loadFile, loadSample } = useActions();
  const { viewer, allowFileDrop, active, pending, diagnostics, attempt, offsets, theme } =
    useAppState();
  const samples = viewer.mode === 'sample-site' ? viewer.samples : undefined;
  const repositoryUrl = viewer.mode === 'sample-site' ? viewer.repositoryUrl : undefined;
  const payload = viewer.mode === 'standalone' ? viewer.payload : undefined;
  const allowExport = !!samples || (!!payload && payload.allowHtmlExport !== false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const diagnosticsButton = useRef<HTMLButtonElement>(null);
  const licenseButton = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const settings = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const license = useRef<HTMLDialogElement>(null);
  const source = active?.source;
  const attribution =
    source?.kind === 'sample' ? samples?.find((item) => item.id === source.id)?.license : undefined;
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.filter((item) => item.severity === 'warning').length;

  useEffect(() => {
    setDiagnosticsOpen(!!attempt);
    if (attempt) setSettingsOpen(false);
  }, [attempt]);

  useEffect(() => {
    const dialog = license.current;
    if (showLicense && attribution && dialog && !dialog.open) dialog.showModal();
    else if (dialog?.open) dialog.close();
  }, [showLicense, attribution]);

  function closeSourceMenu() {
    setSettingsOpen(false);
    if (menuButton.current?.getClientRects().length) menuButton.current.focus();
  }

  function restoreDiagnosticsFocus() {
    const trigger = diagnosticsButton.current;
    (trigger?.getClientRects().length ? trigger : menuButton.current)?.focus();
  }

  useEffect(() => {
    if (!diagnosticsOpen && !settingsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || license.current?.open) return;
      event.preventDefault();
      event.stopPropagation();
      if (diagnosticsOpen) {
        setDiagnosticsOpen(false);
        restoreDiagnosticsFocus();
      } else {
        setSettingsOpen(false);
        menuButton.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !settings.current?.contains(event.target) &&
        !menuButton.current?.contains(event.target)
      )
        setSettingsOpen(false);
      if (
        event.target instanceof Node &&
        !popover.current?.contains(event.target) &&
        !diagnosticsButton.current?.contains(event.target)
      ) {
        setDiagnosticsOpen(false);
      }
    };
    window.addEventListener('keydown', close, true);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', close, true);
      window.removeEventListener('pointerdown', outside);
    };
  }, [diagnosticsOpen, settingsOpen]);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files');
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (allowFileDrop) {
        depth++;
        setDragging(true);
      }
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = allowFileDrop ? 'copy' : 'none';
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file && allowFileDrop) loadFile(file);
    };
    const stop = () => {
      depth = 0;
      setDragging(false);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('blur', stop);
    };
  }, [allowFileDrop, loadFile]);

  async function exportCurrent() {
    if (!active) return;
    const { graph } = active;
    const { workspace } = graph;
    setExporting(true);
    setExportError(false);
    try {
      await downloadHtml(viewer.mode, {
        schemaVersion: 1,
        mode: 'standalone',
        title: active.source.kind === 'embedded' ? payload?.title : undefined,
        workspace,
        precomputedLayout: graph,
        layoutOverrides: Object.keys(offsets).length
          ? { workspaceHash: workspaceHash(workspace), offsets }
          : undefined,
        theme,
        allowFileDrop: payload?.allowFileDrop,
        allowHtmlExport: payload?.allowHtmlExport,
      });
      closeSourceMenu();
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="sources">
      <button
        type="button"
        className="glass mobile-menu-button"
        ref={menuButton}
        aria-label="地図メニュー"
        aria-expanded={settingsOpen}
        aria-controls="source-options"
        onClick={() => setSettingsOpen(!settingsOpen)}
      >
        メニュー
        {errors > 0 && (
          <span className="diagnostic-error" aria-label="エラーあり">
            {' '}
            •
          </span>
        )}
      </button>
      <div className="source-panel" id="source-options" data-open={settingsOpen} ref={settings}>
        {(samples || allowFileDrop || allowExport || diagnostics.length > 0 || repositoryUrl) && (
          <div className="glass source-toolbar">
            {samples && (
              <>
                <label htmlFor="sample-picker" className="sample-label">
                  サンプル
                </label>
                <select
                  id="sample-picker"
                  value={
                    source?.kind === 'sample'
                      ? source.id
                      : source?.kind === 'file'
                        ? ''
                        : samples[0]?.id
                  }
                  onChange={(event) => {
                    const id = event.target.value;
                    if (source?.kind === 'sample' && source.id === id) {
                      closeSourceMenu();
                      return;
                    }
                    loadSample(id);
                    closeSourceMenu();
                  }}
                >
                  {source?.kind === 'file' && (
                    <option value="" disabled>
                      選択
                    </option>
                  )}
                  {samples.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {allowFileDrop && (
              <>
                <input
                  id="workspace-file"
                  ref={fileInput}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) loadFile(file);
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  title="workspace.json を開く (O)"
                  onClick={() => fileInput.current?.click()}
                >
                  JSON を開く
                </button>
              </>
            )}
            {allowExport && (
              <button
                type="button"
                disabled={!active || !!pending || exporting}
                onClick={() => void exportCurrent()}
              >
                {exporting ? '書き出し中…' : 'HTML を書き出す'}
              </button>
            )}
            {diagnostics.length > 0 && (
              <button
                type="button"
                className={errors ? 'diagnostic-error' : warnings ? 'diagnostic-warning' : ''}
                ref={diagnosticsButton}
                aria-expanded={diagnosticsOpen}
                aria-controls={diagnosticsOpen ? 'workspace-diagnostics' : undefined}
                onClick={() => {
                  setDiagnosticsOpen(!diagnosticsOpen);
                  setSettingsOpen(false);
                }}
              >
                診断 <span>{diagnostics.length}</span>
              </button>
            )}
            {repositoryUrl && (
              <a
                className="repo-link"
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub リポジトリを開く"
                title="GitHub リポジトリを開く"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
                <span className="repo-label">GitHub</span>
              </a>
            )}
          </div>
        )}
        <div className="source-caption">
          {exportError && <p role="alert">HTML を書き出せませんでした。</p>}
          <p role="status">
            {pending
              ? `${pending} を読込中…`
              : attempt
                ? `${attempt} の読込に失敗`
                : source?.kind === 'file'
                  ? source.name
                  : ''}
          </p>
          {attribution && (
            <button ref={licenseButton} type="button" onClick={() => setShowLicense(true)}>
              サンプルの出典
            </button>
          )}
        </div>
        <DisplayOptions className="mobile-display-options" />
      </div>
      {diagnosticsOpen && diagnostics.length > 0 && (
        <div
          className="glass diagnostics"
          ref={popover}
          id="workspace-diagnostics"
          aria-label="JSON 診断"
          role="region"
        >
          <div className="panel-heading">
            <h2>JSON 診断</h2>
            <button
              aria-label="診断を閉じる"
              type="button"
              onClick={() => {
                setDiagnosticsOpen(false);
                restoreDiagnosticsFocus();
              }}
            >
              ×
            </button>
          </div>
          {attempt && (
            <p>
              {attempt}
              {active
                ? ' の読込に失敗しました。直前の地図を表示しています。'
                : ' の読込に失敗しました。'}
            </p>
          )}
          <ul>
            {diagnostics.map((item, index) => (
              <li key={index} data-severity={item.severity}>
                <strong>
                  {severityName[item.severity]}
                  {item.path && ` · ${item.path}`}
                  {item.line !== undefined &&
                    ` · ${item.line} 行${item.column === undefined ? '' : ` ${item.column} 列`}`}
                </strong>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {attribution && (
        <dialog
          ref={license}
          className="license"
          aria-labelledby="sample-license-title"
          onClose={() => {
            setShowLicense(false);
            licenseButton.current?.focus();
          }}
        >
          <form method="dialog" className="panel-heading">
            <h2 id="sample-license-title">サンプルの出典</h2>
            <button type="submit" aria-label="出典を閉じる">
              ×
            </button>
          </form>
          <p>
            <a
              href="https://github.com/structurizr/java/tree/master/structurizr-dsl/src/test/resources/dsl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Structurizr 公式 DSL サンプル
            </a>
            （Apache License 2.0）
          </p>
          <pre tabIndex={0}>{attribution}</pre>
        </dialog>
      )}
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div>
            <strong>ここに workspace.json をドロップ</strong>
            <span>読み込んだモデルを地図に表示します</span>
          </div>
        </div>
      )}
    </div>
  );
}
