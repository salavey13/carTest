@echo off
REM Set the output file name
set "outfile=all_py_files.txt"

REM Delete the output file if it already exists
if exist "%outfile%" del "%outfile%"

REM Loop through all .py files in the current directory
for %%f in (*.py) do (
    REM Output the file name (without any symbols)
    echo #%%f >> "%outfile%"
    
    REM Wrap the file content in triple backticks
    echo ``` >> "%outfile%"
    type "%%f" >> "%outfile%"
    echo ``` >> "%outfile%"
    REM Append an empty line as a separator
    echo. >> "%outfile%"
    
    REM Append an empty line as a separator
    echo. >> "%outfile%"
)

echo All fucking Python files have been concatenated into %outfile%.
pause

