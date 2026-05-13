// Lucide icons — 1.5px stroke, currentColor. Inline so we don't need a runtime.
const Icon = ({ d, size = 16, fill = "none", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
    dangerouslySetInnerHTML={{ __html: d }}
  />
);

const Icons = {
  Link: (p) => <Icon {...p} d='<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' />,
  Play: (p) => <Icon {...p} d='<polygon points="5 3 19 12 5 21 5 3"/>' />,
  PlayFilled: (p) => <Icon {...p} fill="currentColor" d='<polygon points="5 3 19 12 5 21 5 3"/>' />,
  Pause: (p) => <Icon {...p} d='<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' />,
  Scissors: (p) => <Icon {...p} d='<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>' />,
  Download: (p) => <Icon {...p} d='<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' />,
  Clock: (p) => <Icon {...p} d='<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' />,
  Sparkles: (p) => <Icon {...p} d='<path d="m9.937 15.5 4.124 0M12 3l8 4.5L12 21 4 7.5 12 3Z"/>' />,
  Gauge: (p) => <Icon {...p} d='<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>' />,
  Settings: (p) => <Icon {...p} d='<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>' />,
  Terminal: (p) => <Icon {...p} d='<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>' />,
  Volume: (p) => <Icon {...p} d='<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' />,
  ChevronDown: (p) => <Icon {...p} d='<polyline points="6 9 12 15 18 9"/>' />,
  ChevronRight: (p) => <Icon {...p} d='<polyline points="9 6 15 12 9 18"/>' />,
  X: (p) => <Icon {...p} d='<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="6" transform="scale(1,1)"/><line x1="6" y1="6" x2="18" y2="18"/>' />,
  Check: (p) => <Icon {...p} d='<polyline points="20 6 9 17 4 12"/>' />,
  Loader: (p) => <Icon {...p} d='<path d="M21 12a9 9 0 1 1-6.22-8.56"/>' />,
  Youtube: (p) => <Icon {...p} d='<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>' />,
  Sun: (p) => <Icon {...p} d='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>' />,
  Moon: (p) => <Icon {...p} d='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' />,
  ArrowRight: (p) => <Icon {...p} d='<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>' />,
  ArrowLeft: (p) => <Icon {...p} d='<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 19"/>' />,
  FileText: (p) => <Icon {...p} d='<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' />,
  ListOrdered: (p) => <Icon {...p} d='<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>' />,
  Folder: (p) => <Icon {...p} d='<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' />,
  Database: (p) => <Icon {...p} d='<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>' />,
  Key: (p) => <Icon {...p} d='<circle cx="8" cy="15" r="4"/><line x1="10.85" y1="12.15" x2="19" y2="4"/><line x1="18" y1="5" x2="20" y2="7"/><line x1="15" y1="8" x2="17" y2="10"/>' />,
  AlertCircle: (p) => <Icon {...p} d='<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' />,
  Plus: (p) => <Icon {...p} d='<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' />,
  MoreHorizontal: (p) => <Icon {...p} d='<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>' />,
  Crop: (p) => <Icon {...p} d='<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>' />,
  Captions: (p) => <Icon {...p} d='<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 13h2"/><path d="M13 13h2"/><path d="M7 17h2"/><path d="M13 17h2"/>' />,
  Maximize: (p) => <Icon {...p} d='<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>' />,
  Type: (p) => <Icon {...p} d='<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>' />,
};

window.Icons = Icons;
