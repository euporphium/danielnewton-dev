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
      className="marquee flex-none flex items-center"
      aria-hidden={ariaHidden || undefined}
    >
      <div className="flex-none flex items-center">
        {messages.map((message) => (
          <div key={message} className="whitespace-nowrap px-8 text-lg">
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
      className={`marquee-container overflow-x-hidden flex relative w-full py-4 bg-gray-900 text-white rounded-lg ${className}`}
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