const paths = {
  home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  courses: '<path d="M21,5c-1.11,-0.35 -2.33,-0.5 -3.5,-0.5c-1.95,0 -4.05,0.4 -5.5,1.5c-1.45,-1.1 -3.55,-1.5 -5.5,-1.5S2.45,4.9 1,6v14.65c0,0.25 0.25,0.5 0.5,0.5c0.1,0 0.15,-0.05 0.25,-0.05C3.1,20.45 5.05,20 6.5,20c1.95,0 4.05,0.4 5.5,1.5c1.35,-0.85 3.8,-1.5 5.5,-1.5c1.65,0 3.35,0.3 4.75,1.05c0.1,0.05 0.15,0.05 0.25,0.05c0.25,0 0.5,-0.25 0.5,-0.5V6C22.4,5.55 21.75,5.25 21,5zM21,18.5c-1.1,-0.35 -2.3,-0.5 -3.5,-0.5c-1.7,0 -4.15,0.65 -5.5,1.5V8c1.35,-0.85 3.8,-1.5 5.5,-1.5c1.2,0 2.4,0.15 3.5,0.5V18.5z"/><path d="M17.5,10.5c0.88,0 1.73,0.09 2.5,0.26V9.24C19.21,9.09 18.36,9 17.5,9c-1.7,0 -3.24,0.29 -4.5,0.83v1.66C14.13,10.85 15.7,10.5 17.5,10.5z"/><path d="M13,12.49v1.66c1.13,-0.64 2.7,-0.99 4.5,-0.99c0.88,0 1.73,0.09 2.5,0.26V11.9c-0.79,-0.15 -1.64,-0.24 -2.5,-0.24C15.8,11.66 14.26,11.96 13,12.49z"/><path d="M17.5,14.33c-1.7,0 -3.24,0.29 -4.5,0.83v1.66c1.13,-0.64 2.7,-0.99 4.5,-0.99c0.88,0 1.73,0.09 2.5,0.26v-1.52C19.21,14.41 18.36,14.33 17.5,14.33z"/>',
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
