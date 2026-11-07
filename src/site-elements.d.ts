import "react";

// The imported site uses a custom <icon> tag.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      icon: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
