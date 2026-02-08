import type { Metadata, Viewport } from 'next';
import './globals.css';

// biome-ignore lint/style/useComponentExportOnlyModules: <->
export const metadata: Metadata = {
	title: 'P2P Service',
};

// biome-ignore lint/style/useComponentExportOnlyModules: <->
export const viewport: Viewport = {
	viewportFit: 'cover',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body suppressHydrationWarning>{children}</body>
		</html>
	);
}
