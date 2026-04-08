type LoadingScreenProps = {
  text?: string;
};

export default function LoadingScreen({
  text = 'Loading...'
}: LoadingScreenProps) {
  return (
    <div className="center-screen">
      <div className="loader-card">
        <div className="loader-spinner" />
        <h3 className="loader-title">Please wait</h3>
        <p className="loader-text">{text}</p>
      </div>
    </div>
  );
}