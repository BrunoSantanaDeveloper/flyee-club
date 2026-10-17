import { NextureIconsProps, sizeHelper, strokeSizeHelper } from "../nexture-icons";

/** A film strip: a video rendered. Drawn for FlyeeClub in the Nexture style (24 grid, two tones). */
export default function NiFilm({
  className,
  variant = "outlined",
  size = "medium",
  oneTone = false,
}: NextureIconsProps) {
  const iconSize = sizeHelper(size);
  const iconStrokeWidth = strokeSizeHelper(iconSize);

  if (variant === "outlined") {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16.9 2.5C18.7943 2.7105 20.2895 4.2057 20.5 6.1C20.9484 10.0333 20.9484 13.9667 20.5 17.9C20.2895 19.7943 18.7943 21.2895 16.9 21.5C13.6333 21.8724 10.3667 21.8724 7.1 21.5C5.2057 21.2895 3.7105 19.7943 3.5 17.9C3.0516 13.9667 3.0516 10.0333 3.5 6.1C3.7105 4.2057 5.2057 2.7105 7.1 2.5C10.3667 2.1276 13.6333 2.1276 16.9 2.5Z"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M13.95 6.25C14.8972 6.3552 15.6448 7.1028 15.75 8.05C16.0502 10.6833 16.0502 13.3167 15.75 15.95C15.6448 16.8972 14.8972 17.6448 13.95 17.75C12.65 17.8982 11.35 17.8982 10.05 17.75C9.1028 17.6448 8.3552 16.8972 8.25 15.95C7.9498 13.3167 7.9498 10.6833 8.25 8.05C8.3552 7.1028 9.1028 6.3552 10.05 6.25C11.35 6.1018 12.65 6.1018 13.95 6.25Z"
          stroke="currentColor"
          strokeWidth={iconStrokeWidth}
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M4.95 6A0.95 0.95 0 1 0 6.85 6A0.95 0.95 0 1 0 4.95 6Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M17.15 6A0.95 0.95 0 1 0 19.05 6A0.95 0.95 0 1 0 17.15 6Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M4.95 10A0.95 0.95 0 1 0 6.85 10A0.95 0.95 0 1 0 4.95 10Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M17.15 10A0.95 0.95 0 1 0 19.05 10A0.95 0.95 0 1 0 17.15 10Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M4.95 14A0.95 0.95 0 1 0 6.85 14A0.95 0.95 0 1 0 4.95 14Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M17.15 14A0.95 0.95 0 1 0 19.05 14A0.95 0.95 0 1 0 17.15 14Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M4.95 18A0.95 0.95 0 1 0 6.85 18A0.95 0.95 0 1 0 4.95 18Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 1 : 0.6}
          d="M17.15 18A0.95 0.95 0 1 0 19.05 18A0.95 0.95 0 1 0 17.15 18Z"
          fill="currentColor"
        />
      </svg>
    );
  } else {
    return (
      <svg
        width={iconSize}
        height={iconSize}
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M16.9 1.75C19.189 2.0043 20.9957 3.811 21.25 6.1C21.6984 10.0333 21.6984 13.9667 21.25 17.9C20.9957 20.189 19.189 21.9957 16.9 22.25C13.6333 22.6224 10.3667 22.6224 7.1 22.25C4.811 21.9957 3.0043 20.189 2.75 17.9C2.3016 13.9667 2.3016 10.0333 2.75 6.1C3.0043 3.811 4.811 2.0043 7.1 1.75C10.3667 1.3776 13.6333 1.3776 16.9 1.75ZM13.95 5.5C15.2918 5.6491 16.3509 6.7082 16.5 8.05C16.8002 10.6833 16.8002 13.3167 16.5 15.95C16.3509 17.2918 15.2918 18.3509 13.95 18.5C12.65 18.6482 11.35 18.6482 10.05 18.5C8.7082 18.3509 7.6491 17.2918 7.5 15.95C7.1998 13.3167 7.1998 10.6833 7.5 8.05C7.6491 6.7082 8.7082 5.6491 10.05 5.5C11.35 5.3518 12.65 5.3518 13.95 5.5ZM4.85 6A1.05 1.05 0 1 0 6.95 6A1.05 1.05 0 1 0 4.85 6ZM17.05 6A1.05 1.05 0 1 0 19.15 6A1.05 1.05 0 1 0 17.05 6ZM4.85 10A1.05 1.05 0 1 0 6.95 10A1.05 1.05 0 1 0 4.85 10ZM17.05 10A1.05 1.05 0 1 0 19.15 10A1.05 1.05 0 1 0 17.05 10ZM4.85 14A1.05 1.05 0 1 0 6.95 14A1.05 1.05 0 1 0 4.85 14ZM17.05 14A1.05 1.05 0 1 0 19.15 14A1.05 1.05 0 1 0 17.05 14ZM4.85 18A1.05 1.05 0 1 0 6.95 18A1.05 1.05 0 1 0 4.85 18ZM17.05 18A1.05 1.05 0 1 0 19.15 18A1.05 1.05 0 1 0 17.05 18Z"
          fill="currentColor"
        />
        <path
          opacity={oneTone ? 0 : 0.4}
          d="M13.95 5.5C15.2918 5.6491 16.3509 6.7082 16.5 8.05C16.8002 10.6833 16.8002 13.3167 16.5 15.95C16.3509 17.2918 15.2918 18.3509 13.95 18.5C12.65 18.6482 11.35 18.6482 10.05 18.5C8.7082 18.3509 7.6491 17.2918 7.5 15.95C7.1998 13.3167 7.1998 10.6833 7.5 8.05C7.6491 6.7082 8.7082 5.6491 10.05 5.5C11.35 5.3518 12.65 5.3518 13.95 5.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }
}
