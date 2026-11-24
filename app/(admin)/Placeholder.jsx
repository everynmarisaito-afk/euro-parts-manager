export default function Placeholder({ title, description }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{description}</p>
        </div>
      </div>
      <div className="card placeholder">この画面は準備中です</div>
    </>
  );
}
