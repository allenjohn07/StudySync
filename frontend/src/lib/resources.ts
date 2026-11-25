// Places to learn more about a topic from class. These are search links built in the browser: they always work,
// and nothing is sent anywhere until the student clicks one.

export interface ResourceLink {
  label: string;
  href: string;
}

export function resourcesFor(topic: string): ResourceLink[] {
  const q = encodeURIComponent(topic.trim());
  return [
    // Wikipedia's search jumps straight to the article when the topic matches one
    { label: "Wikipedia", href: `https://en.wikipedia.org/w/index.php?search=${q}` },
    { label: "Khan Academy", href: `https://www.khanacademy.org/search?page_search_query=${q}` },
    { label: "YouTube", href: `https://www.youtube.com/results?search_query=${q}+explained` },
  ];
}
