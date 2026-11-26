import { useEffect, useRef, useState } from 'react';
import { samples } from '../samples';
import { useActions, useAppState } from '../state/AppStateContext';
import { DisplayOptions } from './ZoomControls';
import { sourceName } from '../state/source';

const severityName = { error: 'エラー', warning: '警告', info: '情報' } as const;

export function SourceControls() {
  const { loadFile, loadSample } = useActions();
  const { active, pending, diagnostics, attempt } = useAppState();
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
  const sample =
    source?.kind === 'sample' ? samples.find((item) => item.id === source.id) : undefined;
  const attribution = sample && 'license' in sample ? sample.license : undefined;
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
      depth++;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
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
      if (file) loadFile(file);
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
  }, [loadFile]);

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
        <div className="glass source-toolbar">
          <label htmlFor="sample-picker" className="sample-label">
            サンプル
          </label>
          <select
            id="sample-picker"
            value={source?.kind === 'sample' ? source.id : ''}
            onChange={(event) => {
              loadSample(event.target.value);
              setSettingsOpen(false);
            }}
          >
            <option value="" disabled>
              選択
            </option>
            {samples.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            id="dsl-file"
            ref={fileInput}
            type="file"
            accept=".dsl"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) loadFile(file);
              event.target.value = '';
            }}
          />
          <button type="button" title=".dsl を開く (O)" onClick={() => fileInput.current?.click()}>
            DSL を開く
          </button>
          {diagnostics.length > 0 && (
            <button
              type="button"
              className={errors ? 'diagnostic-error' : warnings ? 'diagnostic-warning' : ''}
              ref={diagnosticsButton}
              aria-expanded={diagnosticsOpen}
              aria-controls={diagnosticsOpen ? 'dsl-diagnostics' : undefined}
              onClick={() => {
                setDiagnosticsOpen(!diagnosticsOpen);
                setSettingsOpen(false);
              }}
            >
              診断 <span>{diagnostics.length}</span>
            </button>
          )}
        </div>
        <div className="source-caption">
          <p role="status">
            {pending
              ? `${pending} を読込中…`
              : attempt
                ? `${attempt} の読込に失敗`
                : source?.kind === 'file'
                  ? sourceName(source)
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
          id="dsl-diagnostics"
          aria-label="DSL 診断"
          role="region"
        >
          <div className="panel-heading">
            <h2>DSL 診断</h2>
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
                : ' の読込に失敗しました。サンプルか別のファイルを選んでください。'}
            </p>
          )}
          <ul>
            {diagnostics.map((item, index) => (
              <li key={index} data-severity={item.severity}>
                <strong>
                  {severityName[item.severity]} · {item.line} 行 {item.column} 列
                </strong>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
            rel="noreferrer"
          >
            Structurizr 公式 DSL サンプル
          </a>
          （Apache License 2.0）
        </p>
        <pre tabIndex={0}>{attribution}</pre>
      </dialog>
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div>
            <strong>ここに .dsl ファイルをドロップ</strong>
            <span>読み込んだモデルを地図に表示します</span>
          </div>
        </div>
      )}
    </div>
  );
}
