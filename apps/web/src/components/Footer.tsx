export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="zagora-footer">
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 1rem",
        }}
      >
        <p style={{ marginBottom: "0.5rem" }}>
          Built with{" "}
          <a href="https://vocs.dev" target="_blank" rel="noopener noreferrer">
            Vocs
          </a>
        </p>
        <p style={{ marginBottom: "0.5rem" }}>
          <a
            href="https://github.com/tunnckoCore/zagora"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          {" | "}
          <a
            href="https://twitter.com/aspect_dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twitter
          </a>
          {" | "}
          <a
            href="https://www.npmjs.com/package/zagora"
            target="_blank"
            rel="noopener noreferrer"
          >
            npm
          </a>
        </p>
        <p style={{ fontSize: "0.75rem", opacity: 0.7 }}>
          {currentYear} Zagora. Released under the Apache-2.0 License.
        </p>
      </div>
    </footer>
  );
}
