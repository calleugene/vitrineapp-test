/* Text coming from the методист panel may contain markup.

   `stripHtmlTags` — для полей, которые рендерятся как обычный текст:
   переносы <br> превращаем в \n, остальные теги вырезаем.
   `safeHtml` — для полей, которым разрешено оставаться разметкой
   (только <br> и <span>); всё остальное вырезается до вставки в
   dangerouslySetInnerHTML. */
export function safeHtml(value = '') {
  return value.replace(/<(?!\/?(?:br|span)\b)[^>]*>/gi, '');
}

export function stripHtmlTags(text) {
  if (!text) return '';
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
}
