import { Component } from "react";

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown render error",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App render error:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "linear-gradient(180deg, #0b1320 0%, #0f1828 50%, #0a1220 100%)",
          color: "#f5f7fb",
          fontFamily: "Manrope, sans-serif",
        }}
      >
        <div
          style={{
            width: "min(720px, 100%)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            background: "rgba(17, 25, 39, 0.88)",
            padding: "20px",
            boxShadow: "0 24px 60px rgba(2, 6, 23, 0.4)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "24px" }}>Something went wrong while rendering.</h1>
          <p style={{ margin: "10px 0 0", color: "rgba(224, 231, 255, 0.78)" }}>
            Reload the page. If this persists, share the error below.
          </p>
          <pre
            style={{
              marginTop: "14px",
              overflowX: "auto",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(2, 6, 23, 0.6)",
              padding: "12px",
              color: "#fda4af",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            {this.state.errorMessage}
          </pre>
        </div>
      </div>
    );
  }
}