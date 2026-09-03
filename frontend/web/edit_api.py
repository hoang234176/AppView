with open("src/api/downloadApi.js", "r") as f:
    content = f.read()

# Add to downloadApi
content = content.replace(
    "          if (this.onEvent) this.onEvent(data);",
    "          if (this.onEvent) this.onEvent(data);"
) # Just in case, let's keep it clean since it's already parsing everything, the components uses the fields

print("Web API already passes raw data, nothing much to do but verify if any special logic exists.")
