import {useEffect, useState} from 'react';
import {MUSEUM_LOGO, MUSEUM_LOGO_MAX_MB} from '../config';
import {validateLogoFile} from '../utils';

/* Draft museum photo: object URL is revoked on replacement/unmount.
   saveMuseumProfile uploads the file before publishing its stable URL. */
export function useMuseumLogo() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (file?.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
  }, [file]);

  const select = (candidate) => {
    if (!candidate) return;

    const result = validateLogoFile(candidate);
    if (!result.ok) {
      setError(result.reason === 'size'
        ? MUSEUM_LOGO.errors.size(MUSEUM_LOGO_MAX_MB)
        : MUSEUM_LOGO.errors.type);
      return;
    }

    setError('');
    setFile({file: candidate, previewUrl: URL.createObjectURL(candidate)});
  };

  const clear = () => {
    setError('');
    setFile(null);
  };

  /* value сбрасываем, чтобы тот же файл можно было выбрать повторно. */
  const handleInputChange = (event) => {
    select(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    select(event.dataTransfer.files?.[0]);
  };

  /* Подсветка не должна мигать при переходе курсора на дочерние узлы зоны. */
  const handleDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragActive(false);
    }
  };

  return {
    file,
    previewUrl: file?.previewUrl || '',
    dragActive,
    error,
    select,
    clear,
    handleInputChange,
    onDragEnter: (event) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragOver: (event) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };
}
