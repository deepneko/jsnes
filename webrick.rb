require "webrick"

class Logger < WEBrick::HTTPServlet::AbstractServlet
  def do_GET(req, res)
    puts req.body
  end
end

config = {
      :Port => ARGV[0],
      :DocumentRoot => '.',
}

server = WEBrick::HTTPServer.new(config)
#server.mount ".", Logger

trap(:INT){
      server.shutdown
}

server.start
