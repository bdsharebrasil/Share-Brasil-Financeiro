import fitz, os, glob
for path in glob.glob('attached_assets/*.pdf'):
    doc=fitz.open(path)
    print(os.path.basename(path), 'pages=', doc.page_count, 'metadata=', doc.metadata)
    for i,page in enumerate(doc):
        pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False)
        out=f'.agents/outputs/{os.path.splitext(os.path.basename(path))[0]}_page_{i+1}.png'
        pix.save(out)
        print(' rendered', out, page.rect)
