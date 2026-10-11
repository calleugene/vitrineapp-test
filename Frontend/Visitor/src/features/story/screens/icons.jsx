/* Icons shared by the media slot and the result badge. */

export const MEDIA_ICON = {
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 17 4.5-4.2 3 2.8 3.5-3.4L20 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  ar: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m4 7 8 4 8-4M12 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </>
  ),
};

export const RESULT_BADGE = {
  check: <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  star: <path d="m12 4 2.5 5.1 5.6.8-4 3.9 1 5.6L12 22l-5-2.6 1-5.6-4-3.9 5.6-.8L12 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
};
