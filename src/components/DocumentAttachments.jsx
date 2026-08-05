import React, { useRef, useState } from 'react';
import { Plus, FileText, Download, Trash2, AlertTriangle } from 'lucide-react';
import { uploadFile, isImageRef } from '../utils/uploadFile';

/**
 * Upload, list and remove file attachments for a record.
 *
 * Files are stored on disk under the gitignored db/ directory and only their
 * URL is kept in the database, so attachments never bloat db.json and are
 * never committed.
 *
 * `docType` tags each upload, which lets one record hold several kinds of
 * paperwork (Form 16 Part A, Part B, ITR) and show only the relevant ones.
 */
const DocumentAttachments = ({
    documents = [],
    onChange,
    docType = '',
    namePrefix = 'document',
    emptyText = 'No documents uploaded',
    accent = '#38bdf8'
}) => {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    // Only show attachments of this type; untyped ones are legacy and always show.
    const visible = documents
        .map((doc, index) => ({ doc, index }))
        .filter(({ doc }) => !docType || !doc.docType || doc.docType === docType);

    const handleAdd = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        setIsUploading(true);
        setError('');
        try {
            const stored = await uploadFile(file, `${namePrefix}${docType ? `-${docType}` : ''}`, 'documents');
            onChange([...documents, { ...stored, docType, uploadedAt: new Date().toISOString() }]);
        } catch (err) {
            console.error('Document upload failed:', err);
            setError(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = (index) => {
        if (!window.confirm('Remove this document?')) return;
        onChange(documents.filter((_, i) => i !== index));
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717a' }}>
                    {docType || 'Documents'}{visible.length > 0 ? ` (${visible.length})` : ''}
                </span>
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={isUploading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.35rem 0.75rem', borderRadius: '0.6rem',
                        backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: accent, fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase',
                        letterSpacing: '0.05em', cursor: isUploading ? 'not-allowed' : 'pointer',
                        opacity: isUploading ? 0.5 : 1
                    }}
                >
                    <Plus size={12} /> {isUploading ? 'Uploading' : 'Upload'}
                </button>
                <input
                    type="file"
                    ref={inputRef}
                    style={{ display: 'none' }}
                    accept="image/*,application/pdf"
                    onChange={handleAdd}
                />
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <AlertTriangle size={13} style={{ color: '#f87171' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fca5a5' }}>{error}</span>
                </div>
            )}

            {visible.length === 0 ? (
                <p style={{ fontSize: '0.72rem', color: '#52525b', margin: 0 }}>{emptyText}</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {visible.map(({ doc, index }) => {
                        const url = typeof doc === 'string' ? doc : doc.url;
                        const label = (typeof doc === 'string' ? '' : doc.name) || `Document ${index + 1}`;
                        return (
                            <div
                                key={`${url}-${index}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                                    padding: '0.5rem 0.7rem', borderRadius: '0.7rem',
                                    backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)'
                                }}
                            >
                                <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', flexShrink: 0 }}>
                                    {isImageRef(url) ? (
                                        <img src={url} alt={label} style={{ width: 30, height: 30, borderRadius: '0.4rem', objectFit: 'cover' }} />
                                    ) : (
                                        <FileText size={18} style={{ color: '#f87171' }} />
                                    )}
                                </a>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ flex: 1, minWidth: 0, fontSize: '0.72rem', fontWeight: 700, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={label}
                                >
                                    {label}
                                </a>
                                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#71717a', display: 'flex' }} title="Open">
                                    <Download size={13} />
                                </a>
                                <button
                                    onClick={() => handleRemove(index)}
                                    style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', padding: 0 }}
                                    title="Remove"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DocumentAttachments;
