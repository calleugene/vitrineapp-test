import React, {useEffect, useRef} from 'react';
import {useLegalDocuments} from './use-legal-documents';


function DocumentText({document}) {
  return <><p className="legal-version">Редакция от {new Date(`${document.updatedAt}T12:00:00`).toLocaleDateString('ru-RU')} · {document.version}</p><div className="legal-text">{document.blocks ? document.blocks.map((block, index) => block.kind === 'table' ? <div key={index} className="legal-table-scroll" tabIndex={0} role="region" aria-label="Таблица из документа"><table><thead><tr>{block.rows[0].map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr></thead><tbody>{block.rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : <p key={index}>{block.text || '\u00a0'}</p>) : document.text}</div></>;
}

export function LegalDocumentDialog({document, onClose}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = window.document.activeElement;
    dialog.showModal();
    const overflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => {dialog.close(); window.document.body.style.overflow = overflow; previous?.focus();};
  }, []);
  return <dialog ref={ref} className="legal-dialog" aria-labelledby="legal-title" onCancel={onClose} onClick={(event) => {if (event.target === ref.current) onClose();}}>
    <div className="legal-header"><h2 id="legal-title">{document.title}</h2><button autoFocus type="button" onClick={onClose} aria-label="Закрыть документ">×</button></div>
    <div className="legal-scroll" tabIndex={0}><DocumentText document={document} /></div>
    <div className="legal-actions"><a href={`${import.meta.env.BASE_URL}legal/${document.type}`} target="_blank" rel="noopener noreferrer">Открыть на отдельной странице</a><button type="button" onClick={onClose}>Закрыть</button></div>
  </dialog>;
}

export function LegalDocumentPage({type}) {
  const {documents, error, retry} = useLegalDocuments();
  const document = documents.find((item) => item.type === type);
  return <main className="legal-page"><a href={import.meta.env.BASE_URL}>← Вернуться ко входу</a>{error ? <p role="alert">{error} <button onClick={retry}>Повторить</button></p> : document ? <><h1>{document.title}</h1><DocumentText document={document} /></> : <p role="status">{documents.length ? 'Документ не найден' : 'Загрузка документа…'}</p>}</main>;
}
