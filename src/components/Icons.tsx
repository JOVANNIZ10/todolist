import type { PropsWithChildren, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

function IconBase({
  children,
  ...props
}: PropsWithChildren<IconProps>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconSun(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
    </IconBase>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </IconBase>
  )
}

export function IconCalendarRange(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2" />
    </IconBase>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 17h.01" />
    </IconBase>
  )
}

export function IconInbox(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 4h16l2 11a2 2 0 0 1-2 2.3h-3.5L15 20H9l-1.5-2.7H4A2 2 0 0 1 2 15L4 4Z" />
      <path d="M2.5 13H8l1.5 2h5l1.5-2h5.5" />
    </IconBase>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12.5 4.2 4.2L19 6.8" />
    </IconBase>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4 20 .8-4.2L16.6 4a2.4 2.4 0 0 1 3.4 3.4L8.2 19.2 4 20Z" />
      <path d="m14.8 5.8 3.4 3.4" />
    </IconBase>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18M9 6V4h6v2M19 6l-1 15H6L5 6M10 10v7M14 10v7" />
    </IconBase>
  )
}

export function IconClock(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
    </IconBase>
  )
}

export function IconArrowRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </IconBase>
  )
}

export function IconX(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m15 18-6-6 6-6" />
    </IconBase>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 18 6-6-6-6" />
    </IconBase>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </IconBase>
  )
}

export function IconCircleCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.3 2.7 2.7 5.5-5.7" />
    </IconBase>
  )
}

export function IconCalendarCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M16 3v4M8 3v4M3 10h18m-10.7 5.4 2 2 3.8-4" />
    </IconBase>
  )
}

export function IconArrowDownLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17 7 7 17M7 9v8h8" />
    </IconBase>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 4.3 4.3" />
    </IconBase>
  )
}

export function IconRepeat(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M3.5 11V8.5A2.5 2.5 0 0 1 6 6h14" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M20.5 13v2.5a2.5 2.5 0 0 1-2.5 2.5H4" />
    </IconBase>
  )
}

export function IconBell(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </IconBase>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.03-1.56V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.35 9c.25.62.85 1.03 1.56 1.03H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </IconBase>
  )
}

export function IconChartBar(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </IconBase>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />
    </IconBase>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
    </IconBase>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 16V4M7 9l5-5 5 5M4 21h16" />
    </IconBase>
  )
}

export function IconGripVertical(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="18" r="1" />
    </IconBase>
  )
}

export function IconArrowUp(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19V5M7 10l5-5 5 5" />
    </IconBase>
  )
}

export function IconArrowDown(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M7 14l5 5 5-5" />
    </IconBase>
  )
}

export function IconCheckList(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m3 7 2 2 3.5-4M12 7h9M3 15l2 2 3.5-4M12 15h9M3 21h18" />
    </IconBase>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M18.2 14.9c1.8.7 2.8 2.4 2.8 4.6" />
    </IconBase>
  )
}

export function IconCloud(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.3a4.2 4.2 0 0 1 1 8.28" />
    </IconBase>
  )
}

export function IconShare(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </IconBase>
  )
}

export function IconSmartphone(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 5.5h3M11 18.5h2" />
    </IconBase>
  )
}

export function IconCloudOff(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 9.1-2.43M18 8.3a4.2 4.2 0 0 1 1 8.28" />
      <path d="m3 3 18 18" />
    </IconBase>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a3 3 0 0 0-3 3v6.5A2.5 2.5 0 0 0 5.5 15" />
    </IconBase>
  )
}

export function IconLogOut(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M9 16l-4-4 4-4M5 12h11" />
    </IconBase>
  )
}

export function IconUser(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.5 20.5c0-3.8 3.1-6.2 7.5-6.2s7.5 2.4 7.5 6.2" />
    </IconBase>
  )
}

export function IconRefresh(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M18.5 10a7 7 0 0 0-11.8-3.2L4 9.5M5.5 14a7 7 0 0 0 11.8 3.2L20 14.5" />
    </IconBase>
  )
}

export function IconLink(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 13a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 1 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 11a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 1 0 6.4 6.4l1.2-1.2" />
    </IconBase>
  )
}

export function IconLock(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2.5" />
    </IconBase>
  )
}
