import type { Metadata } from 'next';
import './globals.css';

// biome-ignore lint/style/useComponentExportOnlyModules: <->
export const metadata: Metadata = {
	title: 'P2P Service',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
