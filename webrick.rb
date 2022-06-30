require "webrick"

config = {
      :Port => ARGV[0],
      :DocumentRoot => '.',
}

server = WEBrick::HTTPServer.new(config)
trap(:INT){
      server.shutdown
}
server.start
