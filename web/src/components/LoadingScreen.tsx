export default function LoadingScreen({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="center-screen">
      <div className="loader-card">
        <div className="loader-spinner" />
        <p>{text}</p>
      </div>
    </div>
  );
}