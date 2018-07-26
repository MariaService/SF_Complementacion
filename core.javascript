var http = require('http');
var soap = require('soap');
var fs = require('fs');
var path = require('path');
var buffer = require('buffer-equal-constant-time');
var ssh = require('ssh2');
var batch = require('child_process')
var crypto = require('crypto')

var auth = {
	usuario: 'ssp_infraccion',
	password: 'c91f6bc53f25218e34c7c48020b2bcaf'
}

var radaresComplementa = {
	Radares_Service: {
		Radares_Port: {
			procesar_archivo:(args, callback)=>{
				// do some work
					console.log('array: '+JSON.stringify(args));
					var user = {
						usuario: args.pregunta.usuario.$value,
						password: args.pregunta.password.$value
					}

					if(user.usuario === auth.usuario&& user.password === auth.password){
						var fileName = args.pregunta.direccion.$value
						var fullPath = '/home/sspinfra/EMISION/'+fileName.substring(7,11)+'/SALIDA/'
						
						if (fs.existsSync(fullPath)) {
							callback(
								{
									respuesta:{
										error: '0',
										estatus: '100',
										total_registros: '1',
										total_registros_procesados: '1',
										total_registros_correctos: '1',
										total_registros_erroneos: '0',
										inicio_procesamiento: '2017-02-02 11:11:11',
										fin_procesamiento: '2017-02-02 11:11:20'
									}
								}
							)
						}else{
							callback(
								{
									respuesta:{
										error: '100',
										estatus: '29',
										total_registros: '1',
										total_registros_procesados: '1',
										total_registros_correctos: '0',
										total_registros_erroneos: '1',
										inicio_procesamiento: '2017-02-02 11:11:11',
										fin_procesamiento: '2017-02-02 11:11:20'
									}
								})
						}
					}else{
						callback(
							{
								respuesta:{
									error: '100',
									estatus: '29',
									total_registros: '1',
									total_registros_procesados: '1',
									total_registros_correctos: '0',
									total_registros_erroneos: '1',
									inicio_procesamiento: '2017-02-02 11:11:11',
									fin_procesamiento: '2017-02-02 11:11:20'
								}
							}
						)
					}
			}
		}
	}
}

var wsdlxml = require('fs').readFileSync('SSP_Radar.wsdl', 'utf8'),
server = http.createServer(function (request, response) {
response.end("404: Not Found: " + request.url);
});

var PORT = 3128;
var PORT2 = 2222;

server.listen(PORT);

console.log('server running on port ' + PORT);

var utils = ssh.utils;

var OPEN_MODE = ssh.SFTP_OPEN_MODE;
var STATUS_CODE = ssh.SFTP_STATUS_CODE;

var flag = false;

var typeData = '';

var pubKey = utils.genPublicKey(utils.parseKey(fs.readFileSync('./Keys/public.key')))

var sshServer = new ssh.Server({
	hostKeys: [{key:fs.readFileSync('./Keys/id_rsa'), passphrase:'paratocitlythus'}]
}, function(cli){
	cli._sshstream._authFailure = cli._sshstream.authFailure;
cli._sshstream.authFailure = function() {
cli._sshstream._authFailure(['publickey']);
}

	cli.on('authentication', function(ctx){
		if (ctx.method === 'publickey'&& 
			ctx.key.algo === pubKey.fulltype&&
			buffer(ctx.key.data, pubKey.public)) {
			if (ctx.signature) {
				console.log('Autenticating a user')
				var verifier = crypto.createVerify(ctx.sigAlgo);
				verifier.update(ctx.blob);
				if (verifier.verify(pubKey.publicOrig, ctx.signature)){
					console.log('Accepted')
					ctx.accept();
				}else{
					console.log('Rejected')
					ctx.reject();
				}
			} else {
				// if no signature present, that means the client is just checking 
				// the validity of the given public key 
				ctx.accept();
			}
		}else{
			ctx.reject()
		}
	}).on('ready', function(ctx){
		console.log('Connection Ready')
		
	}).on('session', function(accept, reject){
		console.log('Session On')
		var session = accept();
		session.on('exec', function(accept, reject, info){
			console.log('Executing: '+info.command)
			
			var stream = accept();

			var buf = new Buffer(2048);
			
			var infoSplit = info.command.split('/')

			var anioEmision, fileName, remoteDir, tipo, localDir1, localDir2, localDir

			anioEmision = infoSplit[4]

			tipo = infoSplit[5]

			fileName = infoSplit[6]

			remoteDir = ['C:',infoSplit[1], infoSplit[2],infoSplit[3],infoSplit[4],infoSplit[5],''].join('/')

			localDir1 = !flag ? 'C:/radar/EMISION/'+anioEmision+'/'+tipo+'/'+fileName : remoteDir+fileName
			localDir2 = !flag ? 'C:/radar-dev/EMISION/'+anioEmision+'/'+tipo+'/'+fileName:remoteDir+fileName
			localDir = ''

			if (fs.existsSync(localDir1)) {
				localDir = !flag ? localDir1 : 'C:/'+typeData+'/EMISION/'+anioEmision+'/'+tipo+'/'
				if(!flag){ typeData='radar'}
			}else{
				if (fs.existsSync(localDir2)) {
					localDir = !flag ? localDir2 : 'C:/'+typeData+'/EMISION/'+anioEmision+'/'+tipo+'/'
					if(!flag){ typeData='radar-dev' }
				}else{
					localDir ='/'
				}
			}

			var command
			if(!flag){
				command='copy "'+localDir.replace(/\//g,'\\')+'" "'+remoteDir+'"'
			}else{
				command='copy "'+(remoteDir+fileName).toString().replace(/\//g,'\\')+'" "'+localDir.replace(/\//g,'\\')+'"'
			}
			
			console.log(command)

			function generateLC(){
				var text = "";
				var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

				for( var i=0; i < 7; i++ )
					text += possible.charAt(Math.floor(Math.random() * possible.length));

				return text;
			}

			function simulateFalseTransfer(data)
			{
				console.log('writing on buffer')
				if(!flag){
					stream.write(buf);
				}else{
					stream.close()
				}
				
				console.log('Buffer done')
			}

			function processFileToRetrieve(fullDir)
			{

				flag = !flag;

				var defaultData ={
					descuento:'0000000010000',
					porcentaje:'00050',
					importe:'0000000050000',
					derecho:'0000000010000',
					actualizacion:'0000000010000',
					recargo:'0000000050000',
					ceros:'0000000000000',
					total:'0000000070000'
				}
				var detecciones = new Array()

				var resumen = {}

				function crearArchivoSalida(lstDetec,footer, newDir){
					var hoy = new Date()
					var header = 'HSSP '+hoy.getFullYear().toString()+((parseInt(hoy.getMonth()+1)>9)?(hoy.getMonth()).toString():'0'+hoy.getMonth().toString())+((parseInt(hoy.getDate())>9)?hoy.getDate().toString():'0'+hoy.getDate().toString())

					var fileWriter = fs.createWriteStream(newDir);
					fileWriter.once('open', function(fd) {
						
						//Se escribe el Header
						fileWriter.write(header+'\n');

						//Se escribe las detecciones
						for(var i = 0;i < lstDetec.length;i++)
						{
							fileWriter.write(lstDetec[i]+'\n')
						}

						fileWriter.write('T'+footer.totalDetec+footer.totalImporte+'\n')
						fileWriter.end();
						console.log('Procesado del archivo exitoso!')
					});
				}

				var lineReader = require('readline').createInterface({
					input: fs.createReadStream(fullDir)
				})
				
					lineReader.on('line', function (line) {
						//Logica
						var detec = JSON.parse(JSON.stringify(defaultData))

						if(line.startsWith('D'))
						{
							detec.infrac = line.substring(1, 12)
							detec.cond = line.substring(12, 14)
							detec.fecha = line.substring(14,22)

							var formatDate = new Date(detec.fecha.substring(0, 4), detec.fecha.substring(4, 6), detec.fecha.substring(6, 8), 0,0,0,0)
							formatDate.setDate(formatDate.getDate() + 10)
							detec.fechaVig = formatDate.getFullYear().toString()+((parseInt(formatDate.getMonth())>9)?(formatDate.getMonth()).toString():'0'+formatDate.getMonth().toString())+((parseInt(formatDate.getDate())>9)?formatDate.getDate().toString():'0'+formatDate.getDate().toString())
							formatDate.setDate(formatDate.getDate() + 10)
							detec.fechaImpo = formatDate.getFullYear().toString()+((parseInt(formatDate.getMonth())>9)?(formatDate.getMonth()).toString():'0'+formatDate.getMonth().toString())+((parseInt(formatDate.getDate())>9)?formatDate.getDate().toString():'0'+formatDate.getDate().toString())

							detec.lc = '49'+detec.infrac+generateLC()

							detecciones.push('D'
									+detec.infrac
									+detec.cond
									+detec.porcentaje
									+detec.fechaImpo
									+detec.fechaVig
									+detec.descuento
									+detec.importe
									+detec.derecho
									+detec.actualizacion
									+detec.recargo
									+detec.ceros
									+detec.total
									+detec.lc)
						}

						if(line.startsWith('T'))
						{

							var cerosLeft = 6 - (detecciones.length).toString().length
							var count = '';
							var allTotal = 0;
							for(;cerosLeft>0;)
							{
								count = count +'0'
								cerosLeft--
							}
							resumen.totalDetec = count + detecciones.length

							detecciones.forEach(el => {
								allTotal = parseInt(allTotal) + parseInt(el.substring(113, 126))
							});

							cerosLeft = 17 - (allTotal).toString().length
							count=''
							for(;cerosLeft>0;)
							{
								count = count +'0'
								cerosLeft--
							}
							resumen.totalImporte = count +allTotal
							crearArchivoSalida(detecciones, resumen,fullDir.replace('ENTRADA', 'SALIDA').replace(/([E][N])/g, 'S'))
						}
				});
			}

			batch.exec(command,(err, stdout, stderr) => {
				if(!err){
				console.log('Storing Data')
				console.log('FLAG: '+flag)
				simulateFalseTransfer(remoteDir+fileName)
				if(!flag){
					processFileToRetrieve(remoteDir+fileName)
				}
				}
				return
			})
		})
		session.on('close', function(){
			flag=!flag
			console.log('Session closed')
		})
	}).on('error', function(err){
		console.log('Client error: '+err)
	}).on('close',function (err){
		console.log('client closed by error: '+err)
	}).on('end', function(ctx){
		console.log('Client Ended')
	})
}).listen(PORT2, '127.0.0.1', function(){
	console.log('SSH connection listening on port '+this.address().port)
})

soap.listen(server, '/complementaservice', radaresComplementa, wsdlxml);