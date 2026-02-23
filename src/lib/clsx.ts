type ClassValue =
	| string
	| number
	| false
	| null
	| undefined
	| ClassValue[]
	| Record<string, boolean>;

const toClassName = (value: ClassValue, classes: string[]) => {
	if (!value) {
		return;
	}

	if (typeof value === 'string' || typeof value === 'number') {
		classes.push(String(value));
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			toClassName(item, classes);
		}
		return;
	}

	for (const [key, isActive] of Object.entries(value)) {
		if (isActive) {
			classes.push(key);
		}
	}
};

export const clsx = (...values: ClassValue[]) => {
	const classes: string[] = [];

	for (const value of values) {
		toClassName(value, classes);
	}

	return classes.join(' ');
};
