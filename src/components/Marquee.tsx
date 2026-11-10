import "./Marquee.css";

interface MarqueeProps {
  messages: readonly string[];
  duration?: number;
  pauseOnHover?: boolean;
  pauseOnClick?: boolean;
  className?: string;
}

interface MarqueeTrackProps {
  messages: readonly string[];
  ariaHidden?: boolean;
}

function MarqueeTrack({ messages, ariaHidden = false }: MarqueeTrackProps) {
  return (
    <div
      className="marquee flex flex-none items-center"
      aria-hidden={ariaHidden || undefined}
    >
      <div className="flex flex-none items-center">
        {messages.map(message => (
          <div key={message} className="px-8 text-lg whitespace-nowrap">
            <p>{message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Marquee({
  messages,
  duration = 25,
  pauseOnHover = false,
  pauseOnClick = false,
  className = "",
}: MarqueeProps) {
  return (
    <div
      className={`marquee-container relative flex w-full overflow-x-hidden rounded-lg bg-gray-900 py-4 text-white ${className}`}
      style={
        {
          "--marquee-duration": `${duration}s`,
          "--marquee-pause-hover": pauseOnHover ? "paused" : "running",
          "--marquee-pause-click": pauseOnClick ? "paused" : "running",
        } as React.CSSProperties
      }
    >
      <MarqueeTrack messages={messages} />
      <MarqueeTrack messages={messages} ariaHidden />
    </div>
  );
}
