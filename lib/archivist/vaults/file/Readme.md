# File vault

For static content, it often makes a lot of sense to store your files on disk, in your repository.
The "file" vault makes this possible.

## Configuration

```json
{
	"type": "file",
	"config": { "path": "./filevault" }
}
```

## Supported operations

operation | supported | implementation
----------|:---------:|---------------
list      | yes       | `fs.readdir(config.path);`
get       | yes       | `fs.readFile('myfile.filevault' and 'myfile.json');`
add       | yes       | `fs.writeFile('myfile.filevault' and 'myfile.json');`
set       | yes       | `fs.writeFile('myfile.filevault' and 'myfile.json');`
touch     | yes       | `fs.readFile('myfile.filevault'); fs.writeFile('myfile.filevault');`
del       | yes       | `fs.readFile('myfile.filevault'); fs.unlink('myfile.filevault' and 'myfile.json');`
