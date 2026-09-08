from html.parser import HTMLParser
import re

class C(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        if tag in ('div', 'section', 'aside'):
            self.stack.append((tag, self.getpos()[0], dict(attrs).get('class', '')))

    def handle_endtag(self, tag):
        if tag not in ('div', 'section', 'aside'):
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                opened = self.stack.pop(i)
                interesting = ('poems-main', 'poems-layout', 'container', 'section')
                if opened[2] in interesting or opened[2] == 'section' or (opened[0] == 'section'):
                    if opened[2] in interesting or opened[0] == 'section':
                        print(f'close {tag}.{opened[2] or tag} opened L{opened[1]} closed L{self.getpos()[0]}')
                return

html = open('stikhi.html', encoding='utf-8').read()
c = C()
c.feed(html)
print('remaining', [(t, l, cl) for t, l, cl in c.stack if 'poem' in cl or cl == 'container'])
print('search input', 'poems-search' in html)
print('poem count', len(re.findall(r'class="poem-block"', html)))
