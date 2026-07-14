const paths = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  courses: '<path d="M3 4h7c1.1 0 2 .9 2 2v15c0-.55-.45-1-1-1H3V4Zm18 0h-7c-1.1 0-2 .9-2 2v15c0-.55.45-1 1-1h8V4Z"/>',
  checkin: '<path fill-rule="evenodd" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 4h-2v4H7v2h4v4h2v-4h4v-2h-4V7Z"/>',
  grades: '<path d="M4 10h4v10H4V10Zm6-6h4v16h-4V4Zm6 9h4v7h-4v-7Z"/>',
  profile: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13.2a7.16 7.16 0 0 1-5.96-3.18C6.18 14.05 10.02 13 12 13s5.82 1.05 5.96 3.02A7.16 7.16 0 0 1 12 19.2Z"/>',
  notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9zM10 21h4"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 3M18 15a7 7 0 0 1-11.9 3L4 15"/>',
  moon: '<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
};

const solidIcons = new Set(["courses", "checkin", "grades", "profile"]);

export function icon(name, className = "") {
  const body = paths[name];
  if (!body) return "";
  const classAttribute = className ? ` class="${className}"` : "";
  const solid = solidIcons.has(name);
  const paint = solid
    ? 'data-icon-style="solid" fill="currentColor" stroke="none"'
    : 'data-icon-style="outline" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg${classAttribute} aria-hidden="true" viewBox="0 0 24 24" ${paint}>${body}</svg>`;
}
